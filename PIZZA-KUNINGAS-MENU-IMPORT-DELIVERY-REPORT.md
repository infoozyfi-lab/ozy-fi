# Delivery report: full menu replacement — Pizza Kuningas Myyrmäki

## Summary

`worker/migrations/022_pizza_kuningas_menu_import.sql` deletes every existing
category, product, option_group/option row and addon, and replaces them
entirely with Pizza Kuningas Myyrmäki's real menu, exactly as extracted and
verified against the source PDF. `orders`, `order_items`, `admin_settings`
and `bundles` are untouched — confirmed below, not assumed.

This required more judgment calls than a typical migration, because tracing
the actual current code (not just the schema) surfaced a real, previously
unnoticed coupling in `components/ProductPage.tsx`/`lib/pricing.ts`: **the
per-product size selector only renders and only prices correctly when
`has_toppings = 1` on that product** — and `has_toppings = 1` also turns on
this project's entire legacy "pizza builder" UI (crust/sauce/cheese/sauce-
stripe/filling-category/dip rows), none of which has any counterpart in
Pizza Kuningas's real menu. Every modeling decision below either works
around that coupling or, where it can't be avoided, discloses exactly what
it means for the customer-facing page. Nothing outside this one migration
file (plus two new verification files under `worker/test-data/`) was
changed — no application code was touched, per the brief's explicit "a
single migration" scope.

## Final real row counts (confirmed by an actual SQLite run — see "How this was verified")

| Table | Count |
|---|---|
| categories | 14 |
| products | **104** |
| option_groups (kind='size') | 35 |
| options (on size groups) | 60 |
| option_groups (kind='topping', global Lisätäytteet) | 1 |
| options (on the toppings group) | 30 |
| option_groups (kind='base', global crust choice) | 1 |
| options (on the base group) | 2 |
| addons (type='dip') | 7 |
| addons (type='drink') | 3 |
| bundles | 0 (untouched — see "Supertarjoukset") |

The brief's own estimate was "~90 products... adjust if your actual modeling
differs, but show your real count against real expectations." The real count
is **104**, not ~90 — entirely explained by the Burgerit/W4 decision below
(6 burgers × 2 variants + 1 fries-only = 13 products instead of 7, and W4
becomes 2 products instead of 1 with 2 tiers), which the brief's own
estimate didn't anticipate. Per-category breakdown:

Pizzat 21, Uutuus Pizzat 4, Pesto Pizzat 4, Rucola Pizzat 6, Vikingos Pizzat
5, Vegaanipizza 5, Vöner 8, Broilerin/Kebabit/Kanakebabit 12, Burgerit 13
(6×2 + 1), Sides 5 (3 + W4×2), Hot Wings 3, Falafelt 9, Pihvit 4, Salaatit
5. Total: 21+4+4+6+5+5+8+12+13+5+3+9+4+5 = **104**.

Size options: 21 Pizzat + 4 Uutuus Pizzat = 25 products × 2 tiers (Pannu,
Perhe) = 50, plus 4 Pesto Pizzat + 6 Rucola Pizzat = 10 products × 1 tier
(Perhe only) = 10. Total = **60**, matching the brief's own anticipated
formula exactly.

## Deletion order

Traced from the real schema (`worker/schema.sql`), not assumed:
`options` → `option_groups` (references `products.id` via `product_id` for
`'size'` groups) → `products` (references `categories.id`) → `categories` →
`addons` (no FK, deleted for completeness since dips/drinks are fully
replaced too). `bundles` is deliberately **not** deleted or touched —
nothing in this migration creates any bundle rows either (see
"Supertarjoukset" below).

## Supertarjoukset (combo offers) — confirmed excluded

Per the brief, the 6 combo offers are explicitly out of scope (the business
owner is building them via the admin Bundles UI once this base menu
exists). This migration creates zero `bundles` rows. Any pre-existing demo
bundle from ozy.fi's old menu is left as-is in the `bundles` table (it will
reference product ids that no longer exist after this migration — a
pre-existing, disclosed condition the business owner should clear out via
the Bundles admin tab when they set up their real combos, not something
this migration should guess at fixing).

## The central finding: `has_toppings` is not "show a toppings checklist" — it's the whole pizza builder

Traced directly in `components/ProductPage.tsx`: the size-tier buttons,
the Lisätäytteet checklist, the base/sauce/cheese rows, the sauce-stripe
row, the "More fillings" section, and the dip row are **all** nested inside
a single `{selection.toppingsEnabled && (...)}` block — there is no way to
show only some of them. Confirmed a second time in `lib/pricing.ts`'s
`calcUnitPriceFromSelection`: `if (!toppingsEligible) return unit;` — no
option of any kind (size included) ever affects price unless
`has_toppings = 1`. This is why `has_toppings = 1` had to be set on all 35
size-tiered pizzas (Pizzat, Uutuus Pizzat, Pesto Pizzat, Rucola Pizzat) —
it's the only way their size selector displays or prices at all — and why
it was deliberately **not** set on anything else (see below).

Consequence: because this migration deletes the old
base/sauce/cheese/sauce-stripe/filling/dip option groups (none of which
have any real Pizza Kuningas equivalent — no sauce choice, cheese choice,
or "fillings" builder exists on their real menu) per the brief's explicit
full-replacement instruction, those 35 pizza product pages will show a few
inert rows: a sauce row and a cheese row that each collapse to a single
non-interactive "Default" choice, a sauce-stripe row that collapses to
"None", an empty "More Fillings" heading with nothing under it, and (since
dips are intentionally in `addons` instead — see below) a dip row that
collapses to "Select a dip" with only a dead "Default" option inside.

**This does not affect pricing or order correctness in any way** — every
one of those fallback entries has `delta = 0` and was re-confirmed via real
execution (`worker/test-data/menu-import-verify.js`) to resolve to exactly
the expected price with no interference. It's a cosmetic UI gap: a handful
of dead "Default"/"Change" controls on the 35 pizza pages, not fictitious
menu content and not a pricing risk. Two things were done to shrink it
rather than just disclose it:

- **The crust/base row was repurposed with real data instead of left
  dead.** The source document's own note — "gluten-free crust available,
  +4.00 €" — is real Pizza Kuningas menu content, so the `base`-kind group
  now holds "Classic crust" (€0) and "Gluten-free crust" (+€4.00) instead
  of an unpopulated placeholder. This is the one dead row this migration
  could turn into something genuinely useful without inventing anything.
- **The dip row was deliberately left inert, on purpose.** The brief
  explicitly assigns the 7 real dip flavors to the `addons` table (a
  cart-level add-on), which this migration follows. Also populating the
  per-product `dip`-kind option group with the same 7 flavors would put
  "choose a dip" in two different places on the same page — so this row
  stays a placeholder rather than duplicating/conflicting with the addons
  version.
- Sauce, cheese, and sauce-stripe have no real-menu equivalent at all
  (Pizza Kuningas's pizzas are fixed-recipe, not built from a sauce/cheese
  choice), so nothing was invented for them — they stay dead placeholders.

**Recommended follow-up (not done here — outside "a single migration"
scope):** gate each of the base/sauce/cheese/sauce-stripe/"More Fillings"/
dip rows in `ProductPage.tsx` on "does real data exist for this product",
the same way `hasRealSizeTiers` already gates the size row today. That's a
small, single-file, well-precedented change, not a data change, so it
wasn't made as part of this migration — but it's the fix that closes this
gap completely.

## Burgerit Norm./Ateria and W4 3pc/6pc — modeled as separate products, not option groups

The brief invited either reusing `'size'` kind or inventing a new one for
these. Reusing `'size'` was traced and rejected: because `'size'` (like
every option kind) only renders/prices when `has_toppings = 1`, giving a
burger a size-style choice would force it through the exact same pizza-
builder gate as the 35 pizzas above — but for a burger, that isn't just
cosmetic. The **Lisätäytteet checklist itself** (`toppings`, a single
global list — see below) would appear on the burger's page too, offering
pizza toppings like kinkku/salami/ananas on a hamburger. That's fictitious,
wrong-product content, not just an inert placeholder, so it was rejected
outright rather than flagged-and-shipped.

**Decision:** each Norm./Ateria burger becomes two separate product rows
(e.g. `burgerit-0` "H1. Hamburger" at 8.30 €, `burgerit-0-ateria` "H1.
Hamburger — Meal" at 10.50 €, description noting the meal includes fries +
a 0.33 L drink), and W4 becomes two separate rows (`sides-3-3pc` at 7.40 €,
`sides-3-6pc` at 12.40 €). H7 "Pelkät Ranskalaiset" has no Ateria option in
the source table ("— single price only") and stays a single product. This
uses only the well-supported "product" mechanism, invents nothing, and is
exactly why the real product count (104) is higher than the brief's ~90
estimate.

## Kebab/chicken and burger add-ons — informational text, not option groups (and why)

The brief suggested modeling Tupla kebab/jogurttikastike/etc. (kebab) and
120g pihvi/pekoni/etc. (burger) via the same topping-style mechanism,
"scoped appropriately... matching how this project's existing topping
groups are scoped today." Tracing `lib/menu-i18n.ts`'s `normalizeMenuBlob`
shows `kind: 'topping'` is read as **one single global list**
(`toppings = opts`, overwritten per group with no accumulation) — the exact
same "last group wins" behavior every other non-`'size'` kind has. Creating
two more `'topping'`-kind groups (one for kebab add-ons, one for burger
add-ons) would not scope them per-product at all; it would just silently
make whichever one loads last overwrite the others, discarding real data.

Tracing further, the project's own **already-live** convention for exactly
this kind of information — "double kebab/chicken +4.00 €, includes chili,
pickle, tomato..." — was never an interactive option group at all. It was
plain descriptive text in the category's `sub`/`sub_fi` subtitle (see the
old `worker/seed.sql`'s Kebab/Chicken/Burgers categories). That's the real
existing convention for this category type, not an interactive picker, so
this migration follows it: the kebab/chicken category's subtitle states the
double-meat and sauce add-on prices, and the Burgerit category's subtitle
states the burger extras and their 2.50 € price, in both languages. No new
option_group rows were created for these, avoiding the single-global-list
collision above and not inventing a per-product topping-scoping mechanism
that doesn't actually exist in the current code.

## The topping-pricing simplification (flagged per the brief's own instruction)

`lib/pricing.ts`'s `calcUnitPriceFromSelection` reads `menu.toppings[0]?.delta`
and applies that ONE value to every topping a customer picks, regardless of
which topping or which size tier is selected — confirmed directly in the
source, not assumed. The real menu prices toppings at 2.00 € (Normaali) /
2.50 € (Perhe) / 2.50 € (Pannu) — a size-aware price the current pricing
engine has no way to express. Per the brief's own explicit instruction, this
migration uses a single flat value: **2.00 €** (the Normaali-tier price)
for every topping, on every size. Every one of the 30 real topping names is
present and correctly priced at that flat rate; only the Perhe/Pannu
0.50 € surcharge is not represented. Implementing genuine size-aware topping
pricing would be a real code change to `lib/pricing.ts`, `lib/menu-i18n.ts`,
and the admin topping editor — out of this migration's scope, flagged here
rather than silently shipped.

## Other disclosed decisions

- **"Riulla" (item 7 of the chicken/kebab/kanakebab table) is kept exactly
  as printed**, not silently corrected to "Rulla" even though items 8–10
  are all "X Rulla" and this looks like a source typo — per the brief's own
  "do not invent, guess, or improve" instruction, the literal printed text
  was kept.
- **Category id for "Vöner"**: `slugify('Vöner')` strips the `ö` entirely,
  producing `vner` — a worse, harder-to-read id than the project's own
  existing convention (the old seed already used `voner`). `voner` was used
  deliberately instead of the literal `slugify()` output, matching the
  project's own existing convention more faithfully than a mechanical
  function call would have.
- **`worker/seed.sql` was left untouched**, matching this project's own
  precedent from the last two rounds (see `PIZZA-SIZE-FEATURE-DELIVERY-
  REPORT.md` and `PER-PRODUCT-SIZE-DELIVERY-REPORT.md`, both of which made
  the same call). Its own header states it is auto-generated from
  `data/menu.js` via `scripts/generate-seed.mjs` for fresh **local dev**
  bootstrapping — a separate concern from the live database this migration
  actually targets. Hand-editing it would silently desync it from its own
  generator; regenerating it would mean rewriting `data/menu.js` with the
  entire new 104-product menu, a second, out-of-scope pipeline this brief
  never asked for. It still produces a valid, self-consistent (if now
  unrelated-to-Pizza-Kuningas) demo menu for anyone bootstrapping a fresh
  local database, which is all it's for.
- **Product tags**: left `NULL` everywhere except the 5 Vegaanipizza items
  (`tag = 'Vegan'`) — a directly factual, source-confirmed label ("100%
  plant-based" / vegan cheese throughout), not a judgment call. No other
  tags (Spicy, Signature, etc.) were added, to avoid subjective invention.
- **Vikingos Pizzat and Vegaanipizza** (single price, no size tiers) were
  deliberately left at `has_toppings = 0` — the source document doesn't
  extend the Lisätäytteet list to them explicitly, and since they don't
  need `has_toppings` for anything (no size to unlock), turning it on would
  only add the dead placeholder rows for zero real benefit.

## How this was verified

Two independent real-execution passes, not "looks right":

**1. A real SQLite database**, built from the actual current
`worker/schema.sql`, seeded with the actual current `worker/seed.sql` (to
simulate a live pre-migration database, not an empty one) plus two
representative `admin_settings` rows, then the real
`022_pizza_kuningas_menu_import.sql` executed against it via Python's
`sqlite3` module (SQLite-compatible with D1). 24 assertions, all passing:
every row count above, zero orphaned rows (every `option_groups.product_id`
resolves to a real product, every `options.group_id` to a real group, every
`products.category_id` to a real category), no duplicate ids, and — the one
thing this migration must never touch — **`admin_settings` confirmed
byte-for-byte identical before and after**, a real diff, not just "I didn't
write to it."

Spot-checked end to end: `pizzat-0` (1. Bolognese) has base 10.90 € with
Pannu/Perhe tiers computing to the exact printed 16.50 €/19.90 €;
`pesto-pizzat-0` has exactly 2 selectable sizes, not 3; `voner-0` has no
size group at all; the Burgerit/W4 splits produce the right two separate
prices each; H7 has no Ateria variant; every topping option shares the
same 2.00 € delta (required for the pricing formula above to be correct).

**2. The real application code**, not a reimplementation of it —
`worker/test-data/menu-import-verify.js` takes the exact rows the SQLite
run produced and traces them through the real, current
`lib/menu-i18n.ts`'s `normalizeMenuBlob()` and `lib/pricing.ts`'s
`calcUnitPriceFromSelection()`. 22 assertions, all passing: the normalized
blob has the right category/product/topping/base-option/addon counts;
`pizzat-0.sizeOptions` is exactly `[Normaali(+0), Pannu(+5.60),
Perhe(+9.00)]`; `pesto-pizzat-0.sizeOptions` is exactly `[Normaali(+0),
Perhe(+10.00)]`, not 3 entries; `voner-0.sizeOptions` correctly falls back
to the single synthetic "Default" entry; and real end-to-end pricing
matches by hand-computed totals (pizzat-0 + Perhe + 2 toppings +
gluten-free crust = 10.90+9.00+2×2.00+4.00 = **27.90 €**, confirmed exactly).
Also re-confirmed this project's own money-critical guarantee (from the
per-product-size brief) still holds against this new data: a
`sizeOptionId` naming a real option that belongs to a *different* product
contributes 0, never that other product's price.

**Zero regressions**: every one of the 8 pre-existing harnesses from this
engagement's prior 4 rounds (`per-product-size-pricing-harness.js`,
`save-failed-bug-verify.js`, `save-failed-data-model-verify.js`,
`save-failed-pricing-verify.js`, `size-tier-bugfix-cache-verify.js`,
`size-tier-bugfix-menu-i18n-harness.js`, `size-tier-buttons-ui-verify.js`,
`size-not-showing-verify.js`) still passes in full — 72/72 — since this
round touched no application code, only the new migration and two new
`worker/test-data/` verification files.

**Grand total: 118 real-execution assertions, all passing** (24 SQL + 22
application-code + 72 regression).

## Not independently verified

Same sandbox limitation as every prior round: no live D1/Workers/browser
available here. The SQLite dry run is SQLite-compatible with D1's engine
but is not literally D1 — running this migration against the real
production database is the one step only the business owner (or whoever
has D1 access) can actually perform. No screenshot/browser render of the
resulting product pages was taken; the "dead placeholder rows" finding
above is based on direct code reading (`components/ProductPage.tsx`) plus
real pricing-formula execution confirming no price impact, not a visual
screenshot.

## Files changed this round

- `worker/migrations/022_pizza_kuningas_menu_import.sql` — the migration
  (new).
- `worker/test-data/menu-import-verify.js` — new verification harness (22
  assertions).
- `worker/test-data/menu-import-real-rows.json` — the real post-migration
  rows that harness traces through the real app code (a snapshot from the
  SQLite dry run, not hand-constructed).

Nothing else was touched — no component, no `lib/` file, no
`admin_settings`, no `bundles`, no `worker/seed.sql`.
