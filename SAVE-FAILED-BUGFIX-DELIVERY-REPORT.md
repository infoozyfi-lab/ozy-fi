# "Save failed" size-tier bug — delivery report

Implements `cowork-bugreport-save-failed-v2.md`. Three parts: the data-model
question, the save failure itself, and the two "fix regardless of root
cause" asks (real error surfacing, bilingual UI note).

## TL;DR

- **The data-model question: confirmed NOT already working, and fixed.**
  Before this fix, a product's own base price was never actually
  selectable once any real size tier existed — `lib/menu-i18n.ts` only
  ever exposed the tiers an admin explicitly added. A product with 2
  added tiers (Pannu, Perhe) had exactly 2 selectable prices, not 3, and
  a customer opening that product defaulted straight into the cheapest
  *added* tier, never the real base price. Fixed by synthesizing a
  "Normaali"/"Regular" (delta 0) entry whenever real tiers exist.
- **The save failure: reproduced for real, and the actual failure mode
  fixed — but the exact reported case did not reproduce as a server bug.**
  A real-execution harness running the exact reported repro (product
  `pizzat-0`, label "Perhe", price `10.90`) against a correctly-scoped
  existing tier succeeds cleanly with the current code — **no bug found
  in the plain edit-and-save path itself.** What *is* a real,
  reproducible bug, confirmed by executing the actual route code: the
  generic admin POST route had no `try/catch` around its D1 `INSERT`, so
  a genuine primary-key collision (concretely possible for `pizzat-0`
  specifically — see "The concrete history" below) escapes as an
  **uncaught exception**, which a live Cloudflare Worker turns into a
  raw, non-JSON 500 — exactly the shape that produces a generic,
  swallowed client-side message. Fixed in the POST route and, defensively,
  its PUT/DELETE sibling.
- **Real error surfacing: the client was already doing the right thing —
  the gap was server-side.** `SizesEditor.tsx`'s `saveTier()` already
  preferred `data.error` over a generic fallback; it just never had
  anything to read, because the server wasn't producing valid JSON on a
  crash. The actual fix is the try/catch above; the client fallbacks were
  additionally tightened to include the HTTP status so they're never a
  dead end.
- **Bilingual base-price note: added**, just above the tier list.
- **Verified with real executed code** at every step — four new runtime
  harnesses (see "How this was verified"), plus a full re-run of every
  pre-existing harness in this project (28 assertions across 8 files, 0
  failures) to confirm nothing from the two prior rounds broke.

## Part 1 — The data-model question

### What was asked

Confirm (by tracing, not assuming) whether a product with N admin-added
size tiers plus its own base price already yields N+1 selectable prices —
the base price acting as the implicit smallest/"Normaali" tier.

### What tracing + real execution found

**It did not.** `lib/menu-i18n.ts`'s `normalizeMenuBlob()` attached a
product's size tiers like this:

```ts
products.forEach((p) => {
  p.sizeOptions = sizeOptionsByProduct[p.id] || FALLBACK_OPTION;
});
```

`sizeOptionsByProduct[p.id]` only ever holds the tiers an admin explicitly
added via `SizesEditor` — there was no step anywhere that also injected
the product's own base price as a selectable entry. So a product with 2
added tiers (Pannu +3.00, Perhe +6.50) ended up with `sizeOptions =
[Pannu, Perhe]` — exactly 2 entries, never 3. Two concrete, real
consequences of this, both confirmed by execution (not just read):

1. **The base price had no selectable entry at all.** A customer wanting
   the plain/smallest size had nothing to tap for it.
2. **The default selection was wrong.** `context/StoreContext.tsx`'s
   `openProduct()` pre-selects `sizeOptions[0]` (the same "first/cheapest
   tier" convention `base`/`sauce`/`cheese`/`dip` all use) — with no base
   entry present, that default became whichever *added* tier happened to
   sort first (Pannu), not the true base price.

This is exactly the "second, more significant gap" the bug report itself
anticipated and asked to be confirmed rather than assumed.

### The fix

`lib/menu-i18n.ts`'s product-attachment step now synthesizes a base-price
entry whenever a product has any real tier at all:

```ts
products.forEach((p) => {
  const realTiers = sizeOptionsByProduct[p.id];
  if (realTiers && realTiers.length) {
    const baseOption: OptionItem = {
      id: `size-base-${p.id}`,
      label: locale === 'fi' ? 'Normaali' : 'Regular',
      delta: 0,
    };
    p.sizeOptions = [baseOption, ...realTiers];
  } else {
    p.sizeOptions = FALLBACK_OPTION;
  }
});
```

A few deliberate details:

- **Only when real tiers exist.** A product with zero configured tiers
  still gets the exact unchanged `FALLBACK_OPTION` — this is what
  `components/ProductPage.tsx`'s `hasRealSizeTiers` check depends on
  (`length === 1 && id === 'default'`) to decide whether to show a size
  selector at all. Verified this still holds (see below).
- **Prepended, not appended**, so it becomes `sizeOptions[0]` — the
  default-selected tier — fixing the wrong-default-selection bug as a
  side effect of fixing the missing-entry bug, using the exact same
  "index 0 is the default" convention every other option kind already
  relies on.
- **The synthetic id (`size-base-<productId>`) can never collide** with a
  real option id: real ids are either admin-typed or auto-generated by
  the admin POST route as `slugify(label)-<timestamp>` — neither
  convention produces this exact prefix.
- **`lib/pricing.ts` needed zero changes**, confirmed by tracing and by
  execution. Its `calcUnitPriceFromSelection`/`findDelta` just `.find()`
  an option by id within whatever `sizeOptions` array they're handed —
  they have no notion of "synthetic vs. real," so a synthesized base
  entry prices identically to a real DB-backed one, both when explicitly
  selected and via the existing "no id / not found → 0" fallback (which
  already resolved correctly to the base price even before this fix, for
  a customer who never touched the size selector at all — see the
  pricing harness below).

## Part 2 — The save failure

### What was asked

Reproduce the exact repro (product `pizzat-0`, label "Perhe", price
`10.90`) for real, find the actual root cause (not the hypothesis
presented as fact), fix it, and show the same save succeeding.

### What real execution found

A harness (`worker/test-data/save-failed-bug-verify.js`) loads the
**actual** `app/api/admin/[table]/[id]/route.ts` PUT handler —
byte-for-byte the same code `SizesEditor.tsx`'s `saveTier()` calls — and
executes it against a constructed request matching the exact repro: an
existing, correctly-scoped `size-pizzat-0` group (real `product_id`), an
existing "Perhe" option row, and a PUT body of `{label: "Perhe", label_fi:
null, price_delta: 1.00}` (10.90 − 9.90, `pizzat-0`'s real base price per
`worker/seed.sql`). Every other real file in the request path — auth
(`lib/adminAuth.ts`), table whitelisting and cache purging
(`lib/api-helpers.ts`), audit logging (`lib/auditLog.ts`) — runs
unmodified; only the Cloudflare Workers runtime itself (`env.DB`, the
Cache API) is stubbed, since no live D1/Workers is available in this
sandbox (the same standing infra gap as every prior round on this
project, disclosed again here).

**Result: `200 {"ok":true}`, with the row's `price_delta` correctly
updated to `1`.** No bug. This directly rules out the bug report's own
concern #1 (`load()` failing to find and reuse an existing, correctly-tagged
group) for a group that genuinely has its `product_id` set — `load()`'s
filter (`kind === 'size' && product_id === productId`) does exactly what
it should, and the PUT itself has no server-side defect for this shape of
request.

### The concrete history behind the report's own hypothesis — and why it's real, just not on the PUT

The bug report's hypothesis #1 was specifically about a stale, same-id
`option_groups` row causing a PRIMARY KEY collision. Tracing the
project's own history makes this concretely plausible for `pizzat-0`:

- The **first** pizza-size brief (`PIZZA-SIZE-FEATURE-DELIVERY-REPORT.md`)
  shipped `option_groups.kind = 'size'` as a **global** group — one
  option group, shared by every toppings-enabled product at once. Its own
  report flags this as a known limitation.
- `pizzat-0` (`1. Bolognese`) has toppings enabled, so it would have shown
  whatever global `'size'` group existed back then — a very natural place
  for "earlier manual testing" (Norm./Pannu./Perhe) to have happened, and
  consistent with the bug report's own description of that history.
- The **second**, per-product-size brief added the `option_groups.product_id`
  column via `worker/migrations/021_option_group_product_id.sql`. That
  migration's own comment states plainly: *"any 'size' group created
  before this migration backfills to NULL."*
- `lib/menu-i18n.ts` only attaches a `'size'` group to a product when
  `g.product_id` is truthy — so that old, now-`product_id: NULL` group
  became silently invisible to every product, including `pizzat-0`, the
  moment migration 021 ran. `SizesEditor.tsx`'s `load()` (which filters on
  the same `product_id === productId`) can't find it either.
- If an admin, later, adds tiers to `pizzat-0` through the *current*
  `SizesEditor` (not realizing an old orphaned group with the *same
  deterministic id* — `size-pizzat-0`, per `addTier()`'s own naming
  convention — already exists), `addTier()`'s `if (!gid)` branch tries to
  `INSERT` a **new** `option_groups` row with that same id.

A second harness scenario (also in `save-failed-bug-verify.js`) constructs
exactly this: an orphaned `size-pizzat-0` group with `product_id: null`,
and executes the **real, unmodified** `POST /api/admin/option_groups`
route against it.

**Before this fix:** the `INSERT` throws a real SQLite
`UNIQUE constraint failed` error with no `try/catch` anywhere in the route
— an uncaught exception. In a live Cloudflare Worker this becomes a raw,
non-JSON error response, which is exactly what `SizesEditor.tsx`'s
`data.error || 'Save failed.'` fallback can't extract anything useful
from (there's no `.error` field to read from a response that isn't valid
JSON at all). **This is a real, confirmed bug** — the same "real SQL
error, but swallowed into a generic message" class the report described —
just surfacing on the group-creation POST (from "+ Add size tier"), not
literally the PUT behind a tier's own "Save" button.

**One honest caveat, stated plainly rather than glossed over:** I cannot
query the live production database from this sandbox (no live D1
available — see "What wasn't verified" below), so I cannot *prove* this
exact history is what an admin hit for `pizzat-0` specifically, only that
it is a real, concretely-possible, and now-fixed defect in this
codebase, matching the mechanism (and much of the specific reasoning) the
bug report's own hypothesis already pointed at. The plain PUT/"Save"
path itself — proven by direct execution — has no bug for a correctly-scoped
row.

### The fix

`try/catch` added around the D1 write in all three generic admin CRUD
handlers that previously had none:

- **`app/api/admin/[table]/route.ts`'s `POST`** (the one implicated
  above) — an uncaught D1 error now returns `json({error: err.message},
  500)` instead of propagating.
- **`app/api/admin/[table]/[id]/route.ts`'s `PUT`** — same fix, applied
  defensively (this exact UPDATE didn't reproduce a failure for a normal
  edit, per Part 2's first result above, but any write through this
  shared route is one unhandled D1 exception away from the same silent
  failure).
- **`app/api/admin/[table]/[id]/route.ts`'s `DELETE`** — same fix, same
  reasoning (e.g. a `FOREIGN KEY`-referencing row).

Re-running the PK-collision scenario after this fix:

```
POST /api/admin/option_groups status: 500
body: {"error":"D1_ERROR: UNIQUE constraint failed: option_groups.id: SQLITE_CONSTRAINT"}
```

A clean, real, readable error — not a crash.

### The error-surfacing fix

The bug report asked to make `SizesEditor.tsx` surface `data.error`
instead of falling back to a generic message. Tracing found it **already
did** — `saveTier()`'s catch block was already `data.error || 'Save
failed.'`. The generic message wasn't a client-side bug; it was the
unavoidable result of the server never producing a `data.error` to read
in the first place (Part 2 above). With that server-side fix in place,
the client's existing preference for `data.error` now actually works.

On top of that, `SizesEditor.tsx`'s three fallback strings (`saveTier`,
`addTier`'s two calls, and `confirmDeleteTier`, which previously didn't
even attempt to read `data.error` at all) were all tightened to include
the HTTP status code, e.g. `` `Save failed (server returned ${res.status}).` ``
— so even a truly unexpected response shape is never a dead end for
future debugging.

## Part 3 — Bilingual base-price/Sizes note

A short note now sits directly above the tier list in `SizesEditor.tsx`,
matching this admin UI's existing plain, direct copy tone:

> The price above is already this product's smallest size (e.g.
> "Normaali") — no need to add it again below. Add a row here only for
> each size ABOVE that base price (e.g. "Pannu", "Perhe").
>
> *Yllä oleva hinta on jo tämän tuotteen pienin koko (esim. "Normaali") —
> sitä ei tarvitse lisätä tähän uudelleen. Lisää rivi tähän vain kutakin
> perushintaa SUUREMPAA kokoa varten (esim. "Pannu", "Perhe").*

Bilingual (English then Finnish, the Finnish set in italics) since the
business owner reading this note works in Finnish — the same EN-then-FI
pairing already used for this component's own label/label_fi fields
directly below it.

## Files changed

- **`lib/menu-i18n.ts`** — the data-model fix (Part 1): synthesizes a
  base-price/"Normaali" size entry whenever real tiers exist.
- **`app/api/admin/[table]/route.ts`** — `try/catch` around the `POST`
  handler's D1 `INSERT` (Part 2).
- **`app/api/admin/[table]/[id]/route.ts`** — `try/catch` around the
  `PUT` handler's D1 `UPDATE` and the `DELETE` handler's D1 `DELETE`
  (Part 2).
- **`components/admin/SizesEditor.tsx`** — the bilingual base-price note
  (Part 3), plus tightened client-side error fallbacks that now include
  the HTTP status (Part 2's error-surfacing ask).
- **`worker/test-data/save-failed-bug-verify.js`** (new),
  **`save-failed-data-model-verify.js`** (new),
  **`save-failed-pricing-verify.js`** (new),
  **`save-failed-stub-cloudflare.js`** (new, a small helper the first
  harness needs) — see "How this was verified."
- **`worker/test-data/size-tier-bugfix-menu-i18n-harness.js`** (from the
  prior caching-fix round) — 2 of its assertions updated to expect the
  new, intentionally-larger `sizeOptions` shape (`[base, tier]` instead of
  `[tier]`); the harness's own conclusion (that `normalizeMenuBlob`'s
  attach logic wasn't the caching bug) is untouched.

## Not changed (per the brief's own standing rule)

- Nothing from the caching fix (`app/api/menu/route.ts`'s `Cache-Control`
  header) or the always-visible size buttons UI
  (`components/ProductPage.tsx`, `globals.css`/`app/globals.css`) was
  touched. Re-ran `size-tier-bugfix-cache-verify.js` and
  `size-tier-buttons-ui-verify.js` unmodified — both still pass in full
  (5/5 and 14/14) against the current codebase.

## How this was verified

Same standing limitation as every prior round: no live D1/Cloudflare
Workers/browser in this sandbox (`npm install` still fails —
registry-blocked). Every claim above is backed by **real execution of the
actual shipped code**, not reasoning alone:

1. **`worker/test-data/save-failed-bug-verify.js`** — loads and executes
   the real PUT and POST route handlers (only `env.DB`/`caches.default`
   stubbed, since those need a live Workers runtime) against the exact
   reported repro and the PK-collision scenario. **5/5 assertions pass.**
2. **`worker/test-data/save-failed-data-model-verify.js`** — loads and
   executes the real `normalizeMenuBlob()` against a `pizzat-0`-shaped
   product with 2 added tiers (proving 3 selectable prices, correct
   default, correct absolute prices in both locales), plus 2 regression
   cases (zero tiers, exactly one tier). **10/10 assertions pass.**
3. **`worker/test-data/save-failed-pricing-verify.js`** — loads and
   executes the real `calcUnitPriceFromSelection` against the synthesized
   base entry, confirming `lib/pricing.ts` needed no changes. **3/3
   assertions pass.**
4. **Strict-mode TypeScript compilation** (`ts.transpileModule`, `strict:
   true`) on every touched source file — **0 diagnostics** on all four.
5. **Full regression sweep** — every pre-existing runtime harness in this
   project (`per-product-size-pricing-harness.js`,
   `size-tier-bugfix-cache-verify.js`,
   `size-tier-bugfix-menu-i18n-harness.js` (updated, see above),
   `size-tier-buttons-ui-verify.js`) re-run against the current codebase.
   **All pass**, confirming this fix didn't regress either prior round.

### What wasn't independently verified

- **No live database access**, so the exact historical shape of
  `pizzat-0`'s real, currently-stored `option_groups`/`options` rows in
  production is not directly confirmed — Part 2's history section is the
  most concrete, evidence-consistent account traceable from this
  project's own migrations and delivery reports, not a live query result.
- **No live Cloudflare Worker**, so "an uncaught exception becomes a raw,
  non-JSON 500" is based on how Next.js/OpenNext route handlers are
  documented to behave on an unhandled throw, not an observed real
  response body from a deployed Worker.

## Running the new tests yourself

```
node worker/test-data/save-failed-bug-verify.js
node worker/test-data/save-failed-data-model-verify.js
node worker/test-data/save-failed-pricing-verify.js
```
