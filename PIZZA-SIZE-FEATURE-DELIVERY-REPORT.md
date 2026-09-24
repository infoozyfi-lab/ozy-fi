# Pizza size selection feature — delivery report

Implements `cowork-brief-pizza-size-feature-1.md`: a new `option_groups.kind
= 'size'`, reusing the existing `'base'` pattern exactly (required,
single-select), with no real menu data inserted.

## TL;DR

- **No migration needed** — confirmed `option_groups.kind` has no CHECK
  constraint (plain `TEXT NOT NULL` in `worker/schema.sql`).
- **Pricing needed one small, additive line in two places** (client +
  server) — not zero changes, and not new math either. See "Did pricing
  really need no changes?" below for the full trace and why.
- **The UI reuses `BottomRow` verbatim** — the exact same component
  `'base'`/`'sauce'`/`'cheese'` already use — with its own heading so it
  reads as a distinct, clearly-labeled required choice.
- **One real architectural limit was found and is NOT solved by this
  task**: `option_groups` are global, not per-product. This works fine for
  the one throwaway test product below, but as built, it cannot give 90
  different pizzas 90 different size price ladders — see "Found but not
  solved" below. This needs a decision before the real import brief lands.
- **Verified with real executed code**, not just tracing: a runtime
  harness loads the actual (transpiled) `lib/pricing.ts` and runs 12
  assertions against constructed test data — all pass. See "How this was
  verified."

## What changed, file by file

Every change is commented in place with a `Pizza-size-feature brief`
marker — grep for that string to find every touch point.

- **`lib/types.ts`** — `RawOptionGroup.kind` gained `'size'` (additive to
  the union, doesn't affect the existing `| string` fallback). `MenuBlob`
  gained `sizeOptions: OptionItem[]`. `CartLineSelectionData` and
  `Selection` both gained `sizeOptionId?: string` — a **new, separate**
  field, not a reuse of the existing `size: 'M' | 'L'` field (see "The M/L
  naming collision" below for why).
- **`lib/menu-i18n.ts`** — `normalizeMenuBlob()` gained a `case 'size':`
  branch, byte-for-byte the same pattern as `case 'base':` (options from
  the DB if any are configured, else the same `FALLBACK_OPTION` single
  "Default" entry every other unconfigured kind falls back to).
- **`lib/pricing.ts`** — `calcUnitPriceFromSelection()` (the server-side
  re-verification formula) gained one line: `unit +=
  findDelta(menu.sizeOptions, selection.sizeOptionId);`, positioned right
  alongside the existing `baseId`/`sauceId`/`cheeseId` lines.
  `validateSelectionShape()` gained `sizeOptionId` to its list of
  optional-string-if-present fields.
- **`context/StoreContext.tsx`** — the client-side mirror of every change
  above: new `sizeOptions` state (populated from `/api/menu`), one new
  line in `calcUnitPrice()` (mirroring the server formula exactly), a
  default size-option selected when a product page opens (`sizeOptionId:
  sizeOptions[0]?.id`, same "pre-select the first/cheapest option"
  convention as base/sauce/cheese/dip), and `sizeOptionId` carried into the
  cart line's structured pricing data (`selectionData`) so the server can
  re-verify it.
- **`components/ProductPage.tsx`** — a new section using `BottomRow`
  as-is, placed directly under the pre-existing Medium/Large toggle. See
  "How the UI looks/behaves" below.
- **`lib/i18n/en.tsx` / `lib/i18n/fi.tsx`** — one new key,
  `productPage.sizeOptionsHeading` ("Size" / "Koko") — **not** a reuse of
  the existing `productPage.size` key (see "The M/L naming collision").
- **`app/admin/dashboard/page.tsx`** — `'size'` added to the option-group
  `kind` dropdown, plus a hint line in the existing
  `GROUP_KIND_CUSTOMER_VIEW` dictionary so an admin managing option groups
  sees the same "applies to every product, not just one" caveat that's
  called out in this report.
- **`worker/test-data/pizza-size-feature-demo.sql`** +
  **`...-cleanup.sql`** — the throwaway test data (new files, `worker/
  seed.sql` itself is untouched). See "The throwaway test data" below.

Nothing about `'base'`/`'sauce'`/`'topping'`/etc.'s own behavior was
touched — every change above is additive.

## Did pricing really need no changes? (traced, not assumed)

The brief specifically asked for this to be *confirmed by tracing*, not
assumed — here's the actual trace.

`lib/pricing.ts`'s `calcUnitPriceFromSelection()` — the one function both
the client (`StoreContext.tsx`'s `calcUnitPrice`, a "direct port" per that
file's own header comment) and the server (`app/api/orders/route.ts`'s
price re-verification, via `verifyProductLine`/`verifyCartLine`) use to
turn a selection into a euro amount — does **not** loop generically over
whatever `option_groups` kinds happen to be configured. It explicitly
enumerates each kind by name:

```ts
unit += findDelta(menu.baseOptions, selection.baseId);
unit += findDelta(menu.sauceOptions, selection.sauceId);
unit += findDelta(menu.cheeseOptions, selection.cheeseId);
...
unit += findDelta(menu.sauceStripeOptions, selection.sauceStripeId);
unit += findDelta(menu.dipOptions, selection.dipId);
```

So a genuinely new kind is invisible to this formula until it's added
here — the **underlying math** (`findDelta`: look up an option by id, sum
its `price_delta`, or 0 if not found) needed **zero new logic**, exactly
as the brief expected, but the formula needed **one new line** naming the
new kind, in both the server copy (`lib/pricing.ts`) and its client mirror
(`StoreContext.tsx`). That's the full, honest answer: not "no changes at
all," but "the smallest possible additive change, using the exact same
primitive every other kind already uses" — one line, in the same style,
right next to the lines it mirrors.

This was verified with **executed code**, not just reading it — see next
section.

## How this was verified

This sandbox has no live D1 database and (confirmed earlier in this
engagement) `npm install` fails here (registry-blocked transitive
dependency), so there's no real dev server to click through. Verification
used two methods:

1. **Strict-mode TypeScript compilation** — every touched file, 0
   diagnostics (matches this project's `strict: true`, no `any`).
2. **A runtime execution harness** — the actual `lib/pricing.ts` (not a
   reimplementation of it) was transpiled to CommonJS and `require()`d,
   then exercised with a constructed `MenuBlob` modeling one throwaway
   test product with 3 made-up size tiers. 12 real assertions ran against
   the real function calls:
   - Each of the 3 sizes' `calcUnitPriceFromSelection()` result matches
     the expected absolute price (base price + that size's delta) exactly.
   - `verifyProductLine`/`verifyCartLine` — the actual server
     re-verification path — **accepts** the correct total at each size and
     multiple quantities, and **rejects** a tampered (underpriced) total at
     each size, which is the concrete "never trust the client" worked
     example the brief asked for.
   - The pre-existing M/L upcharge and the new size-option delta apply
     **independently and additively**, with no interference between the
     two mechanisms (confirms the naming-collision fix — see next section
     — didn't break the field it's coexisting with).
   - An unrecognized/stale `sizeOptionId` contributes `0`, the same safe
     fallback every other option kind already has, never a crash or a
     silently wrong price.
   - Size options render in **ascending resulting-price order**, driven by
     `sort_order` — verified against a deliberately "source-document-like"
     insertion order (Regular, then the pricier-sounding "Mega", then a
     cheaper "Jumbo" inserted last) to prove display order comes from
     `sort_order`, not insertion order or the option's own name — the
     exact Normaali → Pannu → Perhe scenario the brief describes.

   All 12 assertions pass. Confirmed separately (by reading
   `lib/menu-data.ts`'s `SELECT * FROM options ORDER BY sort_order` query
   and `lib/menu-i18n.ts`'s mapping, which does no re-sorting of its own)
   that this ordering is exactly what reaches `BottomRow` — nothing
   sorts the array a second time anywhere in between.

3. Cross-file wiring (props threaded through `StoreContext` →
   `ProductPage`, the `setOption('sizeOptionId', id)` call using the same
   generic setter `'base'`/`'sauce'`/`'cheese'` already use) was verified
   by reading every call site, the same method used throughout this
   engagement for parts that can't be run live.

## How the `'size'` UI looks/behaves compared to `'base'`

Identical mechanics, distinct presentation:

- **Same component, same behavior.** The new size selector is rendered
  with `BottomRow` — the literal same component `'base'`/`'sauce'`/
  `'cheese'` use. Collapsed, it shows a pill with the currently-selected
  size's label and a "change" chevron; tapping it expands a radio-button
  list of every configured size, each non-default option showing its
  `+X.XX €` delta. Exactly one can be selected, and one always is (defaults
  to the first/cheapest option the moment the product page opens) — the
  brief's "required, single-select, identical to base" requirement, met by
  literal code reuse rather than a new implementation.
- **Different presentation from `'base'`/`'sauce'`/`'cheese'`.** Those
  three share one anonymous "Bottom" heading with no individual labels —
  you only know which row is which by context. The new size selector gets
  its **own** visible heading ("Size" / "Koko"), positioned as its own
  section directly under the pre-existing Medium/Large toggle, so it reads
  as a clear, standalone choice rather than blending into an unlabeled
  list — closer in spirit to how `SauceStripeRow`/`DipRow` each get their
  own heading than to how base/sauce/cheese are grouped.
- **Placement**: directly below the M/L toggle, above the toppings "Finish"
  grid. This was a judgment call (the brief didn't specify exact position)
  — reasoning: for a product where this feature is actually used, a real
  per-pizza size choice is the more consequential decision, so it's placed
  first among the customization options, right after the (separate,
  pre-existing) M/L toggle it visually sits beside.
- **Until a `'size'` group is actually configured**, this section is
  invisible-in-effect on every product: `FALLBACK_OPTION` (a single
  "Default" entry with `delta: 0`) renders exactly the way every other
  unconfigured option kind already does — no visual regression on any
  existing product today.

## The M/L naming collision — found, not silently resolved

The brief asks for the new selector to be labeled "Size"/"Koko" — but a
**pre-existing, unrelated** feature already uses that exact word:
`t.productPage.size` is the label of a hardcoded binary Medium/Large
toggle (`context/StoreContext.tsx`'s `setSize`/`sizeLargeUpcharge`, driven
by a single flat `admin_settings` number, not an `options.price_delta`
row), which renders **immediately above** where this new selector now
sits, on the very same product page, for the very same products.

Per the standing rule ("don't touch the existing kinds' behavior — this is
purely additive"), the M/L toggle was left completely untouched — its
label, its field name (`selection.size: 'M' | 'L'`), and its own price
calculation are all unchanged. The new feature instead:

- uses a **new, separate** field name, `sizeOptionId` (not `size`), on
  both `Selection` and `CartLineSelectionData`, so the two mechanisms can
  never collide or overwrite each other's stored choice;
- uses a **new, separate** translation key, `sizeOptionsHeading` (not
  `size`), so the two labels are independently editable.

The runtime harness above confirms the two now apply correctly and
independently (M/L upcharge + size-option delta both add up on the same
line, neither one clobbering the other).

**What this does *not* resolve**, and what's left as an open question:
once a real `'size'` group exists, a customer opening a pizza's product
page will see **two separate "Size"-labeled controls** stacked on top of
each other — the old M/L toggle, then the new per-tier selector — which
reads as confusing/redundant on a real product, even though the two
labels are now technically distinct strings ("Size" appears twice on
screen either way, once per section). This wasn't invented to be solved
here (it's a business-level question, not a coding one) — options worth
deciding before the real import: (a) hide/disable the M/L toggle entirely
on any product that has a real `'size'` group configured, (b) retire the
M/L toggle altogether once every pizza has real size tiers, or (c) keep
both deliberately (e.g. M/L for non-pizza items, tiered `'size'` groups
only for pizzas) with the M/L label renamed to something like "Portion" to
stop the visual duplication. This needs your call before the next brief.

## Found but not solved: `option_groups` are global, not per-product

This is the most important finding from this task, and it directly
affects whether this "infrastructure" is actually usable for the real
import.

Confirmed directly against `worker/schema.sql`: neither `option_groups`
nor `options` has a `product_id` column, and there's no join table linking
either to specific products. `lib/menu-i18n.ts`'s `normalizeMenuBlob()`
builds exactly **one flat list per kind**, shared by every product on the
menu — this is already true today for `'base'`/`'sauce'`/`'cheese'`, and
it's equally true for the new `'size'` kind, by construction (it reuses
the identical mechanism, per the brief's own explicit instruction).

That's a reasonable design for `'base'`/`'sauce'`/`'cheese'`, where a
"thin crust" or "extra cheese" really does cost the same regardless of
which pizza it's on. It does **not** hold for the real ~90-item import's
actual requirement: *"every pizza has 3 distinct sizes at 3 distinct
prices"* — e.g. one pizza's real Normaali/Pannu/Perhe prices are
10.90€/16.50€/19.90€, while a different pizza on the same menu will have
its **own**, different three prices. Because `option_groups` of a given
kind all collapse into one shared list (confirmed: the `switch` statement
in `normalizeMenuBlob` *replaces* `sizeOptions` each time it encounters a
`'size'`-kind group — it does not keep multiple groups separate), there is
currently no way to give 90 different pizzas 90 different size-price
ladders with this mechanism as built. Every toppings-enabled product would
show the exact same size options and deltas.

This is why the throwaway test in this task uses exactly **one** test
product — with only one product in play, the global-vs-per-product
distinction never surfaces, so the mechanism appears to "just work." It
will not "just work" for 90 differently-priced pizzas without further
schema/architecture work (e.g. an optional `product_id` on `option_groups`
that, when set, scopes that group to just that product, falling back to
the current global behavior when unset — additive, and worth scoping as
its own follow-up rather than something quietly bolted onto this task).

**This needs your decision before the real import brief starts** — it
changes that brief's scope materially (a schema change, not just data
entry).

## The throwaway test data

Per the brief, **no real Pizza Kuningas data was inserted anywhere** —
`worker/seed.sql` is untouched. Instead:

- `worker/test-data/pizza-size-feature-demo.sql` — a **new, separate**
  file (not run by anything automatically) that inserts one test product
  (`TEST-pizza-size-demo`, name prefixed `[TEST]`, left `active = 0` by
  default) and one `'size'` option group with 3 made-up tiers (TEST
  Regular/Jumbo/Mega — not the brief's own illustrative Bolognese numbers,
  and not real menu prices).
- `worker/test-data/pizza-size-feature-demo-cleanup.sql` — deletes exactly
  those rows.
- The file's own header carries a loud warning (repeated here because it
  matters): because `option_groups` are global (see above), running the
  demo script does not just add a size selector to the one test product —
  it immediately adds a "Size" section, with these same TEST tiers, to
  **every** existing pizza in `worker/seed.sql` too, active flag or not.
  **Only run it against a disposable/local/dev database, and run the
  cleanup script right after.** This was a deliberate design decision:
  rather than quietly working around the global-option-group limitation
  for the test (which would have hidden the real limitation from you),
  the test data honestly demonstrates the exact behavior real size data
  would have today, warts and all.

## Standing rules — confirmed intact

- No `cookies()` from `next/headers` anywhere touched.
- Every touched file is `strict: true` TypeScript, no `any` introduced.
- `'base'`/`'sauce'`/`'topping'`/etc.'s existing behavior is unmodified —
  every change is additive (new `case`, new field, new translation key,
  new dropdown option, new UI section).
- No migration — `option_groups.kind` was confirmed to have no CHECK
  constraint before concluding one wasn't needed.
