# Delivery report: "size tiers save successfully but no selector appears on the product page"

## Summary

The bug is real and is now fixed. It is **not** a data problem. The
`option_groups`/`options` rows for `pizzat-0` are correct, `normalizeMenuBlob()`
picks them up correctly, and the product page calls that same, current
function. The break is downstream of all of that, in a client-side React
hydration bug on the standalone product page
(`app/(site)/[locale]/product/[id]/page.tsx` →
`components/ProductPageStandalone.tsx`): a stale-closure-style "ready" flag
caused the page to auto-open the product **before** its real size data had
arrived, and then permanently refused to re-open it once the real data did
arrive a moment later.

This report walks the four numbered checks from the bug report in order,
states what was found for each, and then explains the fix. Every claim below
was checked by extracting and executing the real, current project source —
`worker/test-data/size-not-showing-verify.js` is the harness; run it with
`node worker/test-data/size-not-showing-verify.js` from the project root. It
passes 11/11 assertions against the fixed code.

## Check 1: is the `option_groups`/`options` data itself correct?

**Not the problem.** This was checked directly by reviewing the save path
(`app/api/admin/[table]/route.ts`, already hardened by the prior
save-failed-bugfix round) and by constructing the realistic post-save shape
for `pizzat-0`: one `option_groups` row with `kind: 'size'`,
`product_id: 'pizzat-0'`, and two `options` rows (`Pannu`, `Perhe`) whose
`group_id` correctly points at that group's real id — not an orphaned or
mismatched group. Migration `021_option_group_product_id.sql` (the fix from
the save-crash round) is what makes a fresh `size` group get a correct
`product_id` in the first place, and nothing in this round's tracing found
any sign of it landing in a stale group.

## Check 2: does `normalizeMenuBlob()` pick these rows up against the real current data shape?

**Not the problem.** `worker/test-data/size-not-showing-verify.js` Step 1
loads the real `normalizeMenuBlob()` from `lib/menu-i18n.ts` (not a
reimplementation) and runs it against that exact `option_groups`/`options`
shape. It correctly produces a 3-entry `sizeOptions` array: a synthesized
base/"Normaali" entry (the fix from the prior size-tier-bugfix round) plus
Pannu and Perhe, with the right price deltas. This function is confirmed
correct for this data.

## Check 3: does the product page's data-fetching path actually call that same, current function?

**Yes — and this is where the investigation had to go deeper than "does it
call the right function."** `/api/menu` (the client-side fetch
`context/StoreContext.tsx` uses) does call the real, current
`normalizeMenuBlob()`. But the standalone product page doesn't rely on
`/api/menu` alone — it also renders from **SSR-seeded data**, and that's a
second, separate path with its own function:

- `app/(site)/[locale]/product/[id]/page.tsx` calls `loadMenuData(env)`
  (`lib/menu-data.ts`), which *does* fetch `option_groups`/`options` from D1
  — but the `initialData` object it builds for the client is typed
  `StoreProviderInitialData`, which only carries `categories`/`products`.
  The option/group data `loadMenuData()` fetched is discarded before it ever
  reaches the client.
- The `products` array that *does* reach the client this way is shaped by a
  **different, lighter function** than `normalizeMenuBlob()`:
  `normalizeProducts()`, also in `lib/menu-i18n.ts`. It's used only for this
  SSR seed, and it never sets a `sizeOptions` field on the product at all —
  confirmed directly in Step 1 of the harness (`ssrSeededProduct.sizeOptions
  === undefined`).

So there are, correctly, two different data paths for two different
purposes — the bug isn't that the wrong function is called; it's what
happens with the product before the *right* function's data has arrived.
That's Check 4.

## Check 4: does the rendering logic actually receive a non-empty, real `sizeOptions` array?

**This is where the actual bug is**, and it's a timing bug, not a logic bug
in `hasRealSizeTiers` itself. Traced end to end:

1. `context/StoreContext.tsx` initializes `menuLoading` as
   `useState(!initialData)`. Every standalone product-page visit has SSR
   seeded `initialData`, so `menuLoading` starts `false` — and stays `false`
   for the *entire* duration of the subsequent `/api/menu` fetch, because the
   effect's own `if (!initialData) setMenuLoading(true)` guard only fires
   when there's *no* seed data. `menuLoading === false` was meant to mean
   "the real menu data is here"; for a seeded page it actually means "we have
   SOME data, possibly stale/partial" for the whole time the real fetch is
   in flight.
2. `components/ProductPageStandalone.tsx`'s `AutoOpenProduct` used to gate
   its auto-open effect on that same `menuLoading` flag: `if (menuLoading ||
   activeProduct) return;`. Since `menuLoading` was `false` immediately, this
   fired on the very first render, calling `openProduct()` with the
   SSR-seeded product — the one `normalizeProducts()` built, which has no
   `sizeOptions`. Inside `openProduct()` (`context/StoreContext.tsx`), the
   selection falls back to the single-entry `FALLBACK_OPTION`
   (`{id: 'default', ...}`) whenever `item.sizeOptions` is empty/undefined —
   exactly the case here.
3. That premature call set `activeProduct` to a truthy value. The *same*
   effect's guard (`... || activeProduct`) then permanently skipped every
   later run of the effect — including the one that should have fired once
   the real `/api/menu` fetch resolved moments later with the correct
   3-tier `sizeOptions`. Nothing ever re-opened the product to pick up the
   real data.
4. `components/ProductPage.tsx`'s `hasRealSizeTiers` check
   (`!(selection.sizeOptions.length === 1 && selection.sizeOptions[0].id ===
   'default')`) is itself correct — verified directly in Step 5 of the
   harness — but it was evaluating against a selection permanently stuck on
   `FALLBACK_OPTION`, so it correctly (from its own point of view) hid the
   size selector section entirely. That's the exact symptom reported: no old
   style, no new buttons, nothing.

This also explains why the earlier caching-fix round didn't touch this —
that round was about `/api/menu`'s HTTP cache headers, a completely
different layer from this client-side effect-ordering bug, and incognito
correctly ruled it back out this round.

## The fix

`context/StoreContext.tsx` gets a new state field, `menuFullyLoaded`,
decoupled from `menuLoading`:

- It always starts `false`, regardless of whether `initialData` was seeded.
- It's set to `true` in the same `finally` block that already sets
  `menuLoading` to `false`, so a fetch failure doesn't leave any consumer
  waiting on it forever either.
- It's exposed on `StoreContextValue` and the provider's `value` object
  alongside `menuLoading`.

`components/ProductPageStandalone.tsx`'s `AutoOpenProduct` now reads
`menuFullyLoaded` instead of `menuLoading`, for both the auto-open effect's
guard and the loading-skeleton render decision. That's the only behavioral
change in that file.

**`menuLoading` itself was deliberately left unchanged.** It has exactly
three real consumers in the codebase (confirmed by grep):
`StoreContext.tsx` itself, `ProductPageStandalone.tsx` (now migrated), and
`components/MenuSection.tsx` — the menu-grid page, which only needs
`categories`/`products` (both of which the SSR seed genuinely does provide
correctly) and legitimately benefits from `menuLoading` starting `false` on
a seeded load, to avoid a loading-flash. Changing `menuLoading` itself
instead of adding a new field would have reintroduced that flash on the menu
grid to fix the product page. `MenuSection.tsx` required no changes and was
not touched.

## A broader note, disclosed per this engagement's pattern

This was a general SSR-hydration gap, not something specific to size tiers:
any per-product option kind (base, sauce, cheese, dip) could in principle go
stale the same way on the standalone product page, because they all flow
through the same `AutoOpenProduct` → `openProduct()` path. It's only
*dramatically* visible for size because `hasRealSizeTiers` hides the whole
section outright when stuck on the fallback. The other option kinds degrade
to silently showing a single default choice instead of disappearing —
still wrong, just less visibly broken-looking, and out of this round's
explicit scope. Worth a follow-up look if it matters for this menu, but the
fix here (a data-readiness flag the standalone page's auto-open logic
correctly waits on) closes the gap for all of them at once, not just size.

## What was and wasn't independently verified

Verified by real code execution (not theorized):
- The actual current `normalizeProducts()` never attaches `sizeOptions`.
- The actual current `normalizeMenuBlob()` correctly produces the 3-tier
  array for this data shape.
- The actual current (pre-fix) `AutoOpenProduct` + `openProduct()`,
  driven through a realistic 3-render sequence, reproduces the reported bug:
  auto-opens with `sizeOptions.length === 1, id === 'default'` and never
  recovers.
- The actual current (post-fix) versions of the same files, driven through
  the same 3-render sequence, correctly wait, then open once with all 3 real
  tiers, and don't re-open spuriously on a later unrelated re-render.
- The actual current `hasRealSizeTiers` expression evaluates `true` against
  that fixed selection.
- Zero regressions across all 7 pre-existing harnesses from the previous
  three rounds (72 assertions total, all still passing).

Not independently verified (same sandbox limitation as every prior round —
no live D1/Workers/browser available here):
- The literal production D1 rows for `pizzat-0` right now (Check 1 used the
  most-realistically-constructed equivalent, per the brief's own "or
  most-realistically-constructed" allowance).
- An actual browser render/screenshot of the fixed product page. The React
  effect-ordering behavior was instead verified with a minimal, hand-rolled,
  bug-agnostic `useEffect` scheduler (compares dependency arrays via
  `Object.is`, matching React's own semantics for primitive/reference deps)
  driving the real, unmodified extracted source of both functions — not a
  reimplementation of their logic.

## Files changed this round

- `context/StoreContext.tsx` — added `menuFullyLoaded` state, interface
  field, and provider value; set in the existing `finally` block.
- `components/ProductPageStandalone.tsx` — `AutoOpenProduct` now gates on
  `menuFullyLoaded` instead of `menuLoading`.
- `worker/test-data/size-not-showing-verify.js` — new verification harness
  (11 assertions).

Nothing from the caching fix, the button UI, or the save-crash fix was
touched — each was re-verified via its own existing harness rather than
assumed correct, per the brief's standing rule, and all still pass.
