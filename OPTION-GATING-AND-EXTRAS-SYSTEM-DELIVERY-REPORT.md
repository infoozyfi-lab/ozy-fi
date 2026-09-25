# Option-gating-and-extras-system — delivery report

Three related tasks, delivered together as instructed: (1) gate each
customization row in `components/ProductPage.tsx` on real per-row data
instead of one shared `has_toppings` switch, (2) a general, admin-manageable
"Extras" system for any product, and (3) a freeform "Additional info" field
per product. Task 2 and Task 3 both build on Task 1, in that order, as the
brief asked.

Everything below was verified by really running the code — a real SQLite
database built from `worker/schema.sql`, seeded, migrated, and queried; and
a real runtime harness that loads and calls the actual, current
`lib/menu-i18n.ts` and `lib/pricing.ts` functions (never a reimplementation
of either) — not by inspection alone. See "Verification" at the end for the
full results.

---

## Task 1 — independent row gating

### What changed

`components/ProductPage.tsx` used to nest six different rows — base, sauce,
cheese, sauce-stripe, "More Fillings", and the per-product-option-group dip
picker — inside one `{selection.toppingsEnabled && (...)}` block, with no
row-level check beyond that. A product with `has_toppings = 1` but no real
sauce group configured, say, still rendered a "Sauce" row with a single dead
"Default" choice in it.

Each row now has its own `hasReal*` boolean, checked the same way
`hasRealSizeTiers` already checked the size row before this brief — by
comparing the option list to the exact synthetic single-entry fallback
`lib/menu-i18n.ts` uses when nothing is configured (`{ id: 'default', ... }`
or, for fillings, an empty array), not by array length alone (a real group
with a single option still counts as real):

```
hasRealBase, hasRealSauce, hasRealCheese, hasRealSauceStripe, hasRealDip,
hasRealFillingCategories
```

Only a row whose flag is `true` renders at all. The wrapping "Bottom"
heading (which used to always print above base/sauce/cheese) now only shows
when at least one of those three is real, so an empty heading over zero rows
can never appear either. `CurrentFillings` (the "Current fillings" running
summary, shown right above "More Fillings") is gated by the same
`hasRealFillingCategories` flag as "More Fillings" itself — the brief names
only "the 'More Fillings' section," but `CurrentFillings` has no way to ever
gain an entry when there's nothing to add one from (its only entry point is
"More Fillings"), so leaving it ungated would have been exactly the kind of
dead placeholder this task exists to remove. Flagging this explicitly since
it's a small judgment call beyond the brief's literal wording.

### An important, disclosed limitation

`hasRealSizeTiers` (untouched) and `hasRealExtras` (new, Task 2) are
**genuinely per-product** — `'size'` and `'extra'` are the only two
`option_groups` kinds that are ever scoped by `product_id`
(`worker/schema.sql`). `base`/`sauce`/`cheese`/`sauce_stripe`/`dip`/`filling`
are, and remain, **global lists**, shared by every customizable product —
there is no per-product base/sauce/cheese/etc. data model in this project
today. So `hasRealBase` etc. really mean "has the business owner configured
a real group for this KIND at all," not "does this specific product have
its own base choices" — every `has_toppings = 1` product gets the same
answer for these five rows. That's the honest, current state of the data
model, not a gap introduced by this task — Task 1 was scoped as "decouple
rendering from one shared flag," not "add per-product scoping to five kinds
that have never had it." If per-product base/sauce/cheese/sauce-stripe/dip
data is wanted later, it would need the same `product_id`-scoping treatment
`'size'` and now `'extra'` already have — a natural, but out-of-scope,
follow-up.

### Worked examples (verified — see "Verification" below)

- `pizzat-0`, a real pizza with real base-crust data (Classic vs.
  Gluten-free) from the Pizza Kuningas import: `hasRealBase` is `true`,
  the row shows exactly as before this brief.
- A kebab-category product, against the real current post-import data (no
  sauce/cheese/sauce-stripe/dip/filling groups exist at all yet): every one
  of `hasRealSauce`/`hasRealCheese`/`hasRealSauceStripe`/`hasRealDip`/
  `hasRealFillingCategories` is `false` — none of those rows render. (Its
  size row was already correctly hidden before this brief, since it has no
  `'size'` group; unaffected.)

### What `has_toppings` means now

**Unchanged, load-bearing exactly as before:**

- It's still the single gate on the *entire* pizza-builder block in
  `ProductPage.tsx` — nothing inside `{selection.toppingsEnabled && (...)}`
  renders at all for a product with `has_toppings = 0`.
- It's still the single gate on *pricing* for every kind inside that block
  — `lib/pricing.ts`'s `calcUnitPriceFromSelection` still returns the plain
  base price immediately (`if (!toppingsEligible) return unit;`) for
  toppings/base/sauce/cheese/size/fillings/sauce-stripe/dip, unchanged.

**New as of this brief:** for the six rows Task 1 touched, `has_toppings`
is now a *necessary but no longer sufficient* condition for a row to
render — each row also needs its own real data. Before this brief,
`has_toppings = 1` was sufficient on its own.

**New as of Task 2:** the new `'extra'` kind is **entirely independent** of
`has_toppings`, both for rendering and for pricing — extras were explicitly
required to work on non-customizable products (kebabs), so neither the
extras row's visibility nor its price computation is gated by this flag at
all. `has_toppings` is now specifically "does this product get the
pizza-builder customization system," not "can this product be customized
in any way."

---

## Task 2 — general per-product Extras system

### Design

Generalizes the exact mechanism the per-product `'size'` kind already
proved across four prior rounds — `option_groups.product_id` +
`options.price_delta` + a dedicated admin editor on the product's own edit
page — rather than inventing a second storage mechanism, per the brief's
own instruction.

1. **New `option_groups.kind = 'extra'`.** No schema migration was needed
   for the `kind` column itself — it's a plain `TEXT NOT NULL` with no
   CHECK constraint (confirmed by reading `worker/schema.sql`) — but a new
   migration was still needed for the mandatory data population and for
   Task 3's new columns (see below). Unlike `'size'` (single-select,
   required, always gets a synthesized "Normaali"/base-price entry
   prepended), `'extra'` is **multi-select and optional**, with **no
   synthesized entry** — an extra has no equivalent of the product's own
   price being auto-included. `lib/menu-i18n.ts`'s `normalizeMenuBlob`
   builds a second per-product map (`extraOptionsByProduct`, mirroring
   `sizeOptionsByProduct`) and attaches it as `Product.extraOptions` — an
   empty array (never a fallback placeholder) for a product with nothing
   configured.
2. **Selection shape — multi-select, matching how this project's other
   multi-select kind is represented.** I traced how the existing
   multi-select kind (toppings) represents its selection:
   `Selection.toppings: string[]` / `CartLineSelectionData.toppingIds:
   string[]` — an array of ids, added/removed by `toggleTopping`. Extras
   follow that exact array shape: `Selection.extraIds: string[]` /
   `CartLineSelectionData.extraIds?: string[]`, toggled by a new
   `toggleExtra(id)` (`context/StoreContext.tsx`), keyed by id rather than
   label (toppings are keyed by label for a documented historical reason —
   see the `TOPPING_EMOJI` comment in `ProductPage.tsx` — extras have no
   such precedent to match, so this uses the collision-proof identifier
   from the start).

   One deliberate divergence from toppings, flagged explicitly: toppings'
   *pricing* formula is a flat rate — every selected topping adds the
   *same* `menu.toppings[0].delta`, regardless of which one was picked (a
   known, previously-disclosed simplification, since this project's
   topping data is genuinely flat-priced). Extras are **not** flat-priced —
   "Double meat +4.00€" and "Extra sauce +1.50€" have different real
   prices — so `calcUnitPriceFromSelection` sums **each selected extra's
   own `price_delta`** via a real per-id lookup (the same `findDelta`
   primitive every other kind already uses), not toppings' count-times-one-
   delta shortcut. The brief's own instruction — "sum the price_delta of
   every selected extra" — is exactly this, so there's no actual conflict;
   it's called out here only because "follow the toppings pattern" could be
   misread as "reuse the flat-rate formula too," which would have been
   wrong for this data.
3. **Admin UI — `components/admin/ExtrasEditor.tsx`**, a direct sibling of
   `SizesEditor.tsx`: same CRUD wiring (the generic `/api/admin/
   option_groups` and `/api/admin/options` endpoints), same per-row
   label/label_fi/price/save/remove layout, same `+ Add extra` button,
   rendered directly below `SizesEditor` on
   `app/admin/products/[id]/edit/page.tsx` — works for **any** product,
   not just pizzas. The two differences from `SizesEditor` the brief called
   for: no "synthesized base tier" (an extra's admin-entered price *is*
   its `price_delta` directly — no offset against the product's own base
   price, unlike `SizesEditor`'s absolute-price-minus-base-price
   conversion), and nothing in the UI enforces single-select (there's
   nothing to enforce — the customer side is what's multi-select).
4. **Pricing (`lib/pricing.ts`).** `calcUnitPriceFromSelection` gained a
   `extraOptions: OptionItem[] = []` parameter, threaded through the exact
   same way `sizeOptions` already is at every one of its four call sites
   (`verifyProductLine`, `verifyBundleLine`, `computeCurrentProductPrice`,
   `computeCurrentBundlePrice`) — always **this specific product's own**
   `product.extraOptions`, never a shared list read off `menu`. Extras are
   summed **before** the `if (!toppingsEligible) return unit;` early
   return — the one deliberate structural difference from every other kind
   in this function, and the whole reason extras can price correctly on a
   `has_toppings = 0` product. `validateSelectionShape` gained an
   `extraIds` check, **optional** (not required, unlike `toppingIds`) so a
   historical `selection_json` blob written before this feature existed —
   a past order, reordered — still validates exactly as it did before (same
   backward-compatibility treatment the old M/L `size` key already got from
   an earlier round).
5. **`lib/menu-i18n.ts`.** Covered above — per-product `extraOptions`,
   mirroring `sizeOptionsByProduct`.
6. **Customer-facing rendering (`components/ProductPage.tsx`).** A new
   "Extras" section — a checkbox row per real extra, price badge shown when
   non-zero — rendered when `hasRealExtras` (`selection.extraOptions.length
   > 0`) is true. Placed **outside** the `{selection.toppingsEnabled &&
   (...)}` block, deliberately, so it renders (and prices) on a kebab
   exactly as it does on a pizza.

### Population (mandatory — done)

The real Kebab/Kanakebab/Rintafile category's 5 extras (source:
`pizza-kuningas-menu-extracted.md`, the same document
`022_pizza_kuningas_menu_import.sql` was built from) are seeded onto all 12
real style variants (`kebabit-0` .. `kebabit-11`) by the new migration:

| Extra | Price |
|---|---|
| Double meat (Tupla kebab/kanakebab) | +4.00 € |
| Yogurt sauce (Jogurttikastike) | +1.50 € |
| Garlic sauce (Valkosipulikastike) | +1.50 € |
| Blue cheese (Aurajuusto) | +1.50 € |
| Jalapeño (Jalapeno) | +1.50 € |

Every one of these 60 rows (12 products × 5) is a completely ordinary
`'extra'`-kind `option_groups`/`options` row, managed by the exact same
`ExtrasEditor.tsx` the business owner would use for a self-typed extra —
nothing marks them as special, locked, or harder to edit/remove than
anything typed in fresh. Confirmed by real SQLite query in the
verification pass (`sample == ('extra-kebabit-0', 'Extras', 'Lisät',
'extra', 0, 'kebabit-0')` — no extra columns, no flags).

**Burgerit — judgment call, done.** Populated the same way, on the same
"real, already-verified data" grounds, for every genuine burger:
`burgerit-0` through `burgerit-5` and each of their `-ateria` meal variants
(12 products), all 7 real extras (120 g patty, bacon, cheese, pineapple,
blue cheese, onion, egg — all +2.50 €). **Deliberately excluded:**
`burgerit-6` ("H7. Fries Only" — the source's own "single price only," no
`-ateria` variant either, per the prior round's import). It has no patty at
all, so "extra patty"/"bacon"/"cheese"/etc. would be extras for a burger
this product structurally isn't. This is a product-fit judgment call, not a
data-fidelity one — flagged here as instructed.

### Money-correctness and per-product scoping — proven

Verified with a real runtime harness (`worker/test-data/
option-gating-and-extras-verify.js`, loading the actual, current
`lib/menu-i18n.ts`/`lib/pricing.ts`, never a reimplementation):

- A kebab (`has_toppings = 0`) with 1 selected extra prices at
  `11.90 + 4.00 = 15.90`; with both extras, `11.90 + 4.00 + 1.50 = 17.40` —
  each extra's own delta, summed correctly, **without** `has_toppings`
  being involved at all.
- `verifyProductLine` accepts the correct total (`17.40`) for that
  selection and **rejects** a tampered checkout that claims a different
  product's real extra id — a second product (with its own, empty,
  `extraOptions`) priced against a foreign product's `extraId` contributes
  exactly `0`, never the foreign product's extra price, mirroring the
  already-proven `sizeOptionId` cross-product tamper protection exactly.
- A pizza's existing full pricing formula (size + toppings + base) is
  unaffected by the presence of an (empty) `extraIds` array — no
  regression to any pre-existing kind's pricing.
- A historical `selection_json` blob with no `extraIds` key at all (an
  order placed before this feature existed) still reorders and prices
  correctly from every other field — the same backward-compatibility
  guarantee the old M/L `size` key already had.

---

## Task 3 — freeform "Additional info"

Two nullable, bilingual columns on `products` — `additional_info` /
`additional_info_fi` — added in the same migration as Task 2's data
population. A plain textarea on the product edit page, right alongside the
existing description field (checked first: this admin panel has no
rich-text editor anywhere else — every other long-text field, including
the description field itself, is already a plain textarea — so this
deliberately doesn't introduce a new dependency for one field).

**Placement on the customer-facing page:** directly after the product's own
description, before any customization UI (extras, size, toppings, etc.).
Reasoning: a prep note or allergen callout reads as "more about what this
product is," not "how do I customize it," so it belongs with the
description it's extending, not buried below the options. Typography
matches `.pp-desc` exactly (`.pp-additional-info`, added to both
`app/globals.css` and the admin-layout's mirrored `globals.css`, following
this project's existing "duplicate every `.pp-*` rule in both files" habit)
— no new visual treatment, per the brief's explicit scoping to content, not
layout.

Renders nothing — no heading, no empty box — when unset. Verified: a
product with both, only-English, and neither column set all resolve
through `normalizeProducts`'s bilingual fallback correctly (`'FI note'` /
`'EN note only'` fallback to English / `''` empty), and `''` is exactly what
`ProductPage.tsx`'s `{activeProduct.additionalInfo && (...)}` check treats
as "nothing to show."

---

## Standing rules — confirmed

- No `cookies()` from `next/headers` anywhere touched.
- Fully TypeScript throughout; `strict: true` confirmed for the one file
  (`lib/pricing.ts`) that could be meaningfully strict-checked in isolation
  in this sandbox (no npm registry access — see "Verification" below); no
  `any` introduced anywhere in this delivery.
- The 35 pizzas' existing size/base rows: untouched — same runtime harness
  that proved this in the prior round (`pizzat-0`'s 3-tier ladder, the
  gluten-free crust delta) re-run here with zero regressions.
- Every pre-existing kind's current behavior (`'size'`/`'base'`/`'sauce'`/
  `'cheese'`/`'topping'`/etc.): unchanged — `'extra'` is additive only.
- `package.json`'s `overrides` block and `.npmrc` (`legacy-peer-deps=true`):
  both confirmed intact in the delivered zip.

---

## Verification

**Real SQLite migration dry run** (`worker/migrations/
023_extras_and_additional_info.sql`, Python's `sqlite3`, D1-compatible):
schema (as it existed immediately before this round, i.e. the real live
DB's current shape) → seed → migration 022 → migration 023. All 44
assertions passed:

- `products.additional_info`/`additional_info_fi` columns created.
- `admin_settings` byte-for-byte identical before/after (never touched).
- `orders`/`order_items` untouched (0 rows before and after — never
  touched, as required).
- Exactly 12 kebab `'extra'` groups (`kebabit-0`..`11`), each with exactly
  the 5 correct extras at the correct prices.
- Exactly 12 burgerit `'extra'` groups (`burgerit-0`..`5` + their
  `-ateria` variants), each with exactly the 7 correct extras at the
  correct prices; `burgerit-6` (H7) explicitly has none.
- Zero orphaned `option_groups`/`options` rows; zero duplicate ids; no
  product has more than one `'extra'` group; the 35 `'size'` groups from
  migration 022 are completely untouched.

**Real runtime harness** (`worker/test-data/
option-gating-and-extras-verify.js`, loading the actual current
`lib/menu-i18n.ts`/`lib/pricing.ts` via a real TypeScript transpile + real
`require`, never a reimplementation): 23/23 assertions passed, covering
Task 1's `hasReal*` inputs against real fixture data (base real, the other
four fallback, fillings empty — exactly the live post-import state), Task
2's per-product `extraOptions` attachment, has_toppings-independent extras
pricing, cross-product tamper rejection, `verifyProductLine` accept/reject,
historical-order backward compatibility, and Task 3's bilingual
`additionalInfo` resolution including the empty-string "render nothing"
case.

**Regression sweep** — every pre-existing `worker/test-data/*.js` harness
from every prior round re-run against this round's changes:
`menu-import-verify.js` (22/22), `per-product-size-pricing-harness.js`
(18/18), `save-failed-bug-verify.js`, `save-failed-data-model-verify.js`
(10/10), `save-failed-pricing-verify.js` (3/3), `size-not-showing-verify.js`,
`size-tier-bugfix-cache-verify.js`, `size-tier-bugfix-menu-i18n-harness.js`,
`size-tier-buttons-ui-verify.js` — **all exit 0, zero regressions.**

**Syntax/type checks** — every touched `.ts`/`.tsx` file (`lib/types.ts`,
`lib/menu-i18n.ts`, `lib/pricing.ts`, `lib/api-helpers.ts`,
`lib/admin-resource-fields.ts`, `lib/i18n/en.tsx`, `lib/i18n/fi.tsx`,
`context/StoreContext.tsx`, `components/ProductPage.tsx`,
`components/admin/ExtrasEditor.tsx`, `app/admin/products/[id]/edit/
page.tsx`) transpiled cleanly with the TypeScript compiler, plus a
dedicated `strict: true` pass on `lib/pricing.ts` (the money-critical file)
— clean. **Disclosed limitation:** a full project-wide `tsc --noEmit` was
attempted but the npm registry returned `403 Forbidden` in this sandbox (no
`node_modules` present, and dependencies like `next`/`react`/`@types/*`
can't be installed here) — this matches the verification approach every
prior round in this engagement used for the same reason, not a shortcut
specific to this round.

---

## Files changed

- `worker/schema.sql` — `products.additional_info`/`additional_info_fi`
  columns; `option_groups.kind`/`product_id` comments updated for `'extra'`.
- `worker/migrations/023_extras_and_additional_info.sql` — new migration:
  the two columns, plus the mandatory kebab + judgment-call burgerit extras
  data.
- `lib/types.ts` — `RawProduct.additional_info`/`_fi`;
  `RawOptionGroup.kind` gains `'extra'`; `Product.extraOptions`/
  `additionalInfo`; `Selection.extraIds`/`extraOptions`;
  `CartLineSelectionData.extraIds`.
- `lib/menu-i18n.ts` — `additionalInfo` resolution in `normalizeProducts`;
  `extraOptionsByProduct` + `'extra'` case + per-product attachment in
  `normalizeMenuBlob`.
- `lib/pricing.ts` — `extraOptions` parameter + independent-of-
  `toppingsEligible` summation in `calcUnitPriceFromSelection`; `extraIds`
  shape check in `validateSelectionShape`; all four call sites updated.
- `context/StoreContext.tsx` — `toggleExtra`; extras summed in
  `calcUnitPrice`; `openProduct` snapshots `extraIds`/`extraOptions`;
  `addToCart` builds extras `details` + `selectionData.extraIds`
  independent of `toppingsEnabled`.
- `components/ProductPage.tsx` — Task 1's six `hasReal*` gates; Task 2's
  extras checkbox row; Task 3's additional-info paragraph.
- `components/admin/ExtrasEditor.tsx` — new admin editor.
- `app/admin/products/[id]/edit/page.tsx` — renders `ExtrasEditor`.
- `lib/api-helpers.ts` — `additional_info`/`_fi` added to the `products`
  admin-table column whitelist.
- `lib/admin-resource-fields.ts` — the two new admin form fields.
- `lib/i18n/en.tsx` / `lib/i18n/fi.tsx` — `extrasHeading` translation key.
- `app/globals.css` / `globals.css` — `.pp-additional-info`,
  `.pp-extras-list`/`.pp-extra-row` styles (added to both files, matching
  this project's existing duplication convention for `.pp-*` rules).
- `worker/test-data/option-gating-and-extras-verify.js` — new real-execution
  harness for this brief.
