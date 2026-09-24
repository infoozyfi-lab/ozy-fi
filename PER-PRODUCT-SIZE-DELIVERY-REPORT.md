# Per-product size options + M/L retirement — delivery report

Implements `cowork-brief-per-product-size-1.md`, the direct follow-up to
`cowork-brief-pizza-size-feature-1.md` (see `PIZZA-SIZE-FEATURE-DELIVERY-REPORT.md`
for that prior delivery). Two decisions from this brief: (1) `option_groups`
of kind `'size'` are now genuinely **per-product**, not global; (2) the old
Medium/Large toggle is **fully retired** — no compatibility layer, no
hide-when-a-real-size-group-exists shim, just gone.

## TL;DR

- **One additive migration** — `option_groups.product_id TEXT REFERENCES
  products(id)`, nullable. Every existing row (every current
  base/sauce/cheese/sauce_stripe/dip/topping/filling group) backfills to
  `NULL` and keeps behaving exactly as before. Only `'size'`-kind groups are
  looked up by `product_id` now; every other kind stays global, unchanged.
- **The money-critical fix**: `lib/pricing.ts`'s server-side
  `calcUnitPriceFromSelection` now takes the size options to price against
  as an explicit parameter — **this specific cart line's own product's own
  `sizeOptions`** — instead of reading a shared list off `menu`. Because
  `options.id` is a global `TEXT PRIMARY KEY`, a tampered `sizeOptionId`
  naming a different product's tier is never found in this line's own
  product's array, so it contributes `0` (the same "unrecognized id" fallback
  every other option kind already uses) rather than resolving to another
  product's price. **Verified for real, not just traced** — see "How this
  was verified" below.
- **M/L is fully removed**, not hidden: `Selection.size`,
  `CartLineSelectionData.size`, `sizeLargeUpcharge` (client state, `MenuBlob`
  field, `admin_settings.size_large_upcharge`), `setSize()`, and the M/L
  toggle JSX are all gone. A historical order that already has `'M'`/`'L'`
  stored in its `selection_json` still displays correctly — see "Why
  historical orders are safe" below.
- **The concrete answer to "how do I change one pizza's Large price
  later"**: open that product's own edit page
  (`app/admin/products/[id]/edit/page.tsx`) — it now has a **Sizes** section
  below the regular form, showing that product's own tiers with an editable
  price per tier and an "Add size tier" button. Same `option_groups`/
  `options` storage as always, just surfaced where an admin actually goes to
  edit that pizza.
- The old `sizeOptionsHeading` translation key (kept deliberately separate
  from `size` while M/L's own `size` label still existed) has been
  **consolidated back into `size`**, per the brief's "whichever is the
  smaller, cleaner change."

## What changed, file by file

Every change is commented in place with a `Per-product-size brief` marker
— grep for that string to find every touch point.

### Part 1 — per-product size

- **`worker/migrations/021_option_group_product_id.sql`** (new) —
  `ALTER TABLE option_groups ADD COLUMN product_id TEXT REFERENCES
  products(id);`. `worker/schema.sql` updated to match, so a fresh database
  matches a migrated one.
- **`lib/types.ts`** — `RawOptionGroup.product_id?: string | null`.
  `Product.sizeOptions?: OptionItem[]` — always populated (at least
  `FALLBACK_OPTION`) on a normalized product; optional only for the raw
  `productHint` passthrough shape. `MenuBlob.sizeOptions`/`sizeLargeUpcharge`
  **removed** (no longer global). `CartLineSelectionData.size` and
  `Selection.size` **removed**; `Selection` gained `sizeOptions:
  OptionItem[]` — a per-product snapshot captured once when that product's
  page opens (mirrors how `basePrice`/`toppingsEnabled` are already
  snapshotted there).
- **`lib/menu-i18n.ts`** — `normalizeMenuBlob()` no longer builds one global
  `sizeOptions` list. It builds `sizeOptionsByProduct: Record<string,
  OptionItem[]>` keyed by each `'size'`-kind group's own `product_id`
  (groups with no `product_id` are simply skipped for this purpose — see
  "What a global `'size'` group with no product now does" below), then
  after normalizing `products`, attaches `p.sizeOptions =
  sizeOptionsByProduct[p.id] || FALLBACK_OPTION` onto each one directly.
- **`lib/pricing.ts`** (the money-critical file) — `calcUnitPriceFromSelection`
  gained a required `sizeOptions: OptionItem[]` parameter, used in place of
  the old `menu.sizeOptions` read. All four call sites
  (`verifyProductLine`, `verifyBundleLine`, `computeCurrentProductPrice`,
  `computeCurrentBundlePrice`) now pass **the specific product they already
  looked up for that line**: `product.sizeOptions || []`. This is the whole
  fix — see "The per-product lookup, traced end to end" below.
- **`context/StoreContext.tsx`** — client mirror of the same change.
  `calcUnitPrice` now reads `product.sizeOptions` (the `Selection`'s own
  snapshot) instead of a context-level global list. `openProduct` snapshots
  `item.sizeOptions` onto the new selection when a product page opens.
  `addToCart` reads `selection.sizeOptions` for its details-string lookup
  and carries `selection.sizeOptionId` into the cart line's structured
  pricing data, unchanged in spirit from before.
- **`components/ProductPage.tsx`** — the per-product `'size'` selector
  (still `BottomRow`, unchanged UI) now reads `selection.sizeOptions`
  instead of a global context value.
- **`app/admin/dashboard/page.tsx`** — the Option Groups form
  (`optionGroupFields`) gained a `product_id` select ("Product (only used
  by 'Size' groups)") so an admin can scope a size group to one product from
  that tab too, not only from the new Sizes section below.
  `GROUP_KIND_CUSTOMER_VIEW['size']`'s hint text updated from "applies to
  EVERY product... not per-product" to reflect the new per-product reality.
- **`lib/api-helpers.ts`** — `ADMIN_TABLES.option_groups.cols` gained
  `'product_id'` so the generic admin CRUD routes accept it.
- **`components/admin/SizesEditor.tsx`** (new) — the "part that most
  directly answers 'how do I change one pizza's Large price later'". See
  its own section below.
- **`app/admin/products/[id]/edit/page.tsx`** — renders `<SizesEditor>`
  directly below the existing `ResourceForm`.

### Part 2 — retiring the M/L toggle

- **`components/ProductPage.tsx`** — the Medium/Large toggle block (JSX,
  `setSize('M')`/`setSize('L')` buttons, the upcharge sub-label) is deleted.
  The per-product `'size'` selector is now the only size-related control on
  the page, using the plain `t.productPage.size` heading.
- **`context/StoreContext.tsx`** — `setSize()`, the `sizeOptions`/
  `sizeLargeUpcharge` context state and their `/api/menu` population, the
  M/L details-string push in `addToCart` (`t.productPage.largeUpchargeDetail(...)`),
  and `size: selection.size` in the cart line's structured pricing data are
  all removed. `setSize`/`sizeOptions`/`sizeLargeUpcharge` are no longer
  exposed on the store's context value at all.
- **`lib/pricing.ts`** — `validateSelectionShape` no longer checks for a
  `size` field; `calcUnitPriceFromSelection` no longer adds any M/L
  upcharge.
- **`lib/types.ts`** — `Selection.size`/`CartLineSelectionData.size`
  removed (see Part 1 above — same edit).
- **`lib/i18n/en.tsx` / `lib/i18n/fi.tsx`** — `medium`, `large`, and
  `largeUpchargeDetail` keys removed. `sizeOptionsHeading` removed and
  **consolidated into `size`**, which is now the per-product selector's sole
  heading (previously `size` meant the M/L toggle's own label, and
  `sizeOptionsHeading` existed only to avoid colliding with it while both
  existed).
- **The orphaned `size_large_upcharge` admin setting** — the brief left
  this as "your call, note what you did." I removed it rather than
  repurposing the slot: nothing else in this project needed a lone
  cross-product numeric setting, and reusing the same key for something
  unrelated seemed more likely to confuse a future reader than a clean
  removal. Concretely:
  - `app/api/admin/settings/route.ts` — `MENU_PRICING_KEYS` (a Manager
    access allow-list that existed **solely** to let a Manager save this one
    field) is removed entirely, along with its use in `managerCanAccessKey`.
  - `app/admin/dashboard/page.tsx` — `PricingRulesBox` (the "Pricing rules"
    box on the Product Management landing page) is removed along with its
    render call. It had no other content once this field was gone, so an
    empty box would have been worse than no box.
  - `data/menu.ts` / `scripts/generate-seed.mjs` / `worker/seed.sql` — the
    demo/placeholder seed data's own `SIZE_LARGE_UPCHARGE` constant and its
    `admin_settings` insert are removed too, so the generic seed data (still
    no real Pizza Kuningas content — untouched otherwise) doesn't insert a
    now-dead setting. The live database is never touched by this delivery;
    an already-deployed `size_large_upcharge` row there simply becomes an
    inert, unread key, same as any other retired `admin_settings` row in
    this project's history (see `lib/menu-i18n.ts`'s own comment on this).

## The per-product lookup, traced end to end

**Server (`lib/pricing.ts`, the authoritative path `POST /api/orders`
depends on):**

1. Every call site (`verifyProductLine`, `verifyBundleLine`,
   `computeCurrentProductPrice`, `computeCurrentBundlePrice`) already looks
   up the real product row for a cart line via `menu.products.find(p => p.id
   === line.productId)` before doing anything else — that was true before
   this brief too.
2. That `product` object's own `.sizeOptions` (populated once, server-side,
   by `normalizeMenuBlob()` from this product's own `product_id`-scoped
   `'size'` group) is what gets passed into
   `calcUnitPriceFromSelection(..., product.sizeOptions || [])`.
3. Inside `calcUnitPriceFromSelection`, the size delta is `findDelta(sizeOptions,
   selection.sizeOptionId)` — a plain array `.find(o => o.id ===
   selection.sizeOptionId)`, searching **only** the array passed in, never
   any other product's.
4. `options.id` is `TEXT PRIMARY KEY` in `worker/schema.sql` — globally
   unique across the whole table. So a `sizeOptionId` that belongs to a
   *different* product's size group can never coincidentally match an entry
   in *this* product's own `sizeOptions` array (they're disjoint id sets by
   construction) — it simply isn't found, and `findDelta`'s existing
   "not found → 0" fallback applies, exactly like an outright fabricated id
   would. A cross-product tamper attempt can never resolve to another
   product's (potentially cheaper) delta.
5. The product's **base price** itself (`product.price`) is also always
   read server-side from `menu.products.find(...)`, never from anything the
   client sent — so even the "did I get this product's honest minimum
   price" question doesn't depend on trusting the request at all.

**Client (`context/StoreContext.tsx`), same shape, for the live price
shown before checkout:**

1. `openProduct()` snapshots `item.sizeOptions` (the product's own
   normalized size tiers) onto `Selection.sizeOptions` the moment that
   product's page opens — a snapshot, not a live subscription to some
   shared list, mirroring how `basePrice`/`toppingsEnabled` were already
   snapshotted there before this brief.
2. `calcUnitPrice()` reads `product.sizeOptions` (i.e. `selection.sizeOptions`
   — the parameter is the `Selection` itself) instead of any
   context-level global value — there is no longer a context-level
   `sizeOptions` at all.
3. This means the client-side displayed price and the server-side
   re-verified price are computed from the literal same per-product data
   shape, just reached two different ways (a snapshot on `Selection` vs. a
   fresh `menu.products.find(...)` lookup) — which is exactly why the
   cross-product tamper test below is meaningful: it's testing the actual
   formula the checkout path runs, not a stand-in.

## What a global `'size'` group with no product now does

A `'size'`-kind `option_groups` row can still technically exist with
`product_id IS NULL` (nothing stops it at the schema level — the column is
just nullable). `normalizeMenuBlob()`'s new `case 'size':` branch only adds
a group to `sizeOptionsByProduct` when `g.product_id` is truthy, so a
`NULL`-`product_id` `'size'` group is simply **never attached to any
product** — it's inert, not "global" in the old sense. This was the
simplest, least-surprising behavior given the brief's explicit requirement
("must support each product having its own distinct set") — there is no
more "one shared size ladder for every pizza" concept for this kind, by
design. Every product without its own `'size'` group (product_id-scoped)
falls back to `FALLBACK_OPTION` (the same single "Default" entry every
other unconfigured option kind already uses), exactly as the brief's
verification point (e) asks for.

## The Sizes admin editor (`components/admin/SizesEditor.tsx`)

Rendered directly on the product edit page, below the regular product
form. Design:

- Loads this product's own `'size'`-kind option group (if any) and its
  options via the existing generic `/api/admin/option_groups` and
  `/api/admin/options` endpoints — **no new API route**, reusing the same
  CRUD surface every other admin resource already goes through.
- Each tier is edited as an **absolute price** ("what the customer actually
  pays for this size"), converted to/from the stored `price_delta`
  (relative to the product's own base price) only at the read/save
  boundary — an admin thinking "make Large cost €14.90" shouldn't have to
  do delta arithmetic themselves.
- "+ Add size tier": if this product has no `'size'` group yet, creates one
  first (`id: 'size-<productId>'`, `product_id: <productId>`) — this can
  never collide with a fixed global group id (`base`, `sauce`, ...) or
  another product's group (`size-<that product's id>`) — then adds a new
  option row with `sort_order` computed as one past the current maximum.
- Each row has its own "Save" (enabled once you've actually edited that
  row) and "Remove" (behind the same `ConfirmDialog` component every other
  admin delete in this project already uses).
- A product with zero tiers shows "this product is sold at one price
  only" and offers "Add size tier" — no separate empty/error state to
  design around.

## Why historical orders are safe

Confirmed by tracing every consumer of a stored `order_items.selection_json`
blob:

- Every admin order view, the customer-facing invoice, and the `/track`
  page all render `order_items.details` — a **frozen JSON array of
  already-formatted display strings**, built once at order-creation time
  (e.g. `"Large (+3.50 €)"` via the old `t.productPage.largeUpchargeDetail(...)`)
  and never re-derived from `selection_json` afterward. None of these views
  touch `selection.size` at all, so removing the field that produced that
  string changes nothing about how a past order displays — the string is
  already baked into the row.
- The **only** consumer that re-parses `selection_json` is the reorder
  feature (`computeCurrentProductPrice`/`computeCurrentBundlePrice` via
  `GET /api/orders/[orderNum]/reorder`), which prices a historical
  selection at **today's** prices. `validateSelectionShape` no longer
  checks for a `size` key, so a stale `size: 'M'|'L'` property on an old
  blob is just an inert extra property on the parsed object — harmless,
  ignored, and specifically exercised in this brief's runtime harness (see
  below, assertion group 5 and 7).

## How this was verified

**Executed for real** (not just traced) — a runtime harness
(`worker/test-data/per-product-size-pricing-harness.js`) transpiles the
actual `lib/pricing.ts` to CommonJS, `require()`s it, and calls its real
exported `calcUnitPriceFromSelection`, `verifyProductLine`, and
`computeCurrentProductPrice` against constructed data that mirrors
`worker/test-data/per-product-size-demo.sql`'s two independent test
products exactly (same ids, same base prices, same tier deltas). **18/18
assertions pass.** Run it yourself with:

```
node worker/test-data/per-product-size-pricing-harness.js
```

What it actually proves, by section:

1. **Two independent products, each own correct price** — product A's
   three tiers (8.00 / 10.50 / 13.00 €) and product B's two tiers (11.00 /
   15.75 €) each compute correctly from their own `sizeOptions` array.
2. **`verifyProductLine` accepts legitimate lines** for both products,
   including a qty > 1 case, proving the full check (not just the inner
   formula) works per-product.
3. **Cross-product tamper — the delta itself never leaks**: pricing product
   B using product A's real `'test-size-a-jumbo'` id (delta `+2.50`)
   against B's own `sizeOptions` array yields B's plain base price
   (`11.00`), **not** `13.50` (what it would be if A's delta had wrongly
   applied) — the id simply isn't found in B's array.
4. **Cross-product tamper — full `verifyProductLine` rejection**: a
   request checking out product B (true minimum price `11.00`) while
   claiming a `lineTotal` equal to product A's cheap base price (`8.00`)
   and referencing one of A's own real option ids is **rejected**
   (`ok: false`) — this is `POST /api/orders`' exact authoritative check,
   run for real against this exact attack shape. A second variant (claiming
   B's own cheap tier's id while paying B's expensive tier's price) is
   rejected the same way, for the same reason: the server always recomputes
   from the claimed product's own current data, never trusts the client's
   arithmetic.
5. **M/L is genuinely inert, not just visually hidden**: a selection
   carrying a stray `size: 'L'` key adds zero price, and
   `validateSelectionShape` doesn't reject the extra property.
6. **No size group configured** — a product whose `sizeOptions` is only
   `FALLBACK_OPTION` prices correctly at its plain base price, and a
   foreign size id against it still contributes `0` rather than crashing or
   resolving to something unexpected.
7. **Reorder / historical compatibility** — `computeCurrentProductPrice`
   correctly prices a `selection_json`-shaped blob carrying **both** an old
   `size: 'L'` key and a real `sizeOptionId`, at today's prices, with the
   stale key contributing nothing.

**Traced, not independently executed** (same honesty bar as the prior
delivery): the admin UI flow (`SizesEditor` → generic
`/api/admin/option_groups`/`/api/admin/options` routes → D1) — this
sandbox has no live D1/Wrangler dev server available (confirmed
unavailable in the prior delivery too: `npm install` fails on a
registry-blocked transitive dependency), so "open a test product's edit
page, change a tier's price, save, reload, see it live" could not be run
end-to-end here. It's traced instead: `SizesEditor`'s save button PUTs to
`/api/admin/options/[id]`, which is the exact same generic, already-in-
production route every other admin resource edit already goes through
(`app/api/admin/[table]/[id]/route.ts`, driven purely by
`ADMIN_TABLES[tableName].cols` — updated to include `product_id` for
`option_groups`). Every strict-TypeScript file touched was also checked
individually with a `ts.transpileModule({ strict: true })` syntax pass —
all show 0 diagnostics.

## Test data

`worker/test-data/per-product-size-demo.sql` (+ its
`-cleanup.sql` counterpart) replaces the prior brief's now-stale
`pizza-size-feature-demo.sql` (deleted — its own header warning describes
a "global 'size' group" behavior that no longer exists for this kind).
Same conventions as before: throwaway, clearly `[TEST]`-labeled,
`active = 0` by default, never touches `worker/seed.sql`, and is **not**
run by anything automatically — you run it yourself against a
disposable/local database only:

```
npx wrangler d1 execute ozyfi-db --local --file=./worker/test-data/per-product-size-demo.sql
```

It creates **two** separate test products (`TEST-per-product-size-a`,
`TEST-per-product-size-b`), each with its own `'size'` group, its own base
price, and deliberately dissimilar tier names/deltas/counts — specifically
so the two-product-independence and cross-product-tamper scenarios above
are provable, not just plausible.

## Verification checklist against the brief

- **(a) two products, independent prices, no leakage** — harness sections
  1–2 (executed).
- **(b) tampered cross-product request rejected** — harness section 4
  (executed) — the brief's own words: "run for real if at all possible,
  given how central it is." It was.
- **(c) admin workflow: edit one product's own Large price, see it live** —
  traced (see "Traced, not independently executed" above); the underlying
  route is the same generic, already-proven admin CRUD path every other
  resource uses.
- **(d) M/L removal doesn't break historical order display** — confirmed
  by tracing every display consumer (frozen `details` strings only) plus
  harness section 7 (reorder path, executed).
- **(e) no size group → no selector, works as today** — harness section 6
  (executed) plus `ProductPage.tsx`'s `BottomRow` already falls straight
  through to `FALLBACK_OPTION`'s single "Default" entry, same as
  sauce-stripe/dip.
