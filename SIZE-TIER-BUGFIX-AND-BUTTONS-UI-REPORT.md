# Size-tier caching bug fix + always-visible size buttons — delivery report

Two independent tasks bundled in `cowork-bugreport-new-size-tier-not-showing.md`.

---

## Task 1 — Bug fix: newly-added size tiers didn't show on the customer page

### Root cause (confirmed, not guessed)

**It's caching, not a data-flow bug.** `app/api/menu/route.ts`'s response
carried `Cache-Control: public, max-age=300, s-maxage=300`. `max-age`
(distinct from `s-maxage`) is the directive a customer's own **browser**
obeys — with it set to 300, a browser that had already fetched `/api/menu`
once would reuse its own cached copy for up to 5 minutes and would not
even make a new network request in that window, no matter what an admin
just changed or purged **server-side**. `purgeMenuCache()` (called
correctly by every admin write `SizesEditor` goes through) only ever
touches the **server-side** edge cache — there is no mechanism for a
server-side purge to reach into a browser that already has its own cached
copy. That mismatch is the whole bug: the code comment's own assumption
("admin edits already purge this instantly") was only true for the edge
cache, not for the browser sitting in front of it.

This also explains the report's "either doesn't show the new tier, or
doesn't show any size selector change at all" framing: once a customer's
`StoreContext` state is populated from one `/api/menu` fetch, it is never
refetched again for the rest of that browsing session (the fetch effect
only depends on `[locale]`) — so anyone who was already browsing the site
(the most natural way to manually test this) would see stale data for the
rest of that session regardless of how long they waited or how many times
they reloaded within the cache window.

**Ruled out, for real, not just by reading the code:** a data-flow bug in
`lib/menu-i18n.ts`'s `normalizeMenuBlob()` (the function that attaches a
product's own `'size'`-kind group to `product.sizeOptions`). A runtime
harness (`worker/test-data/size-tier-bugfix-menu-i18n-harness.js`) loads
the actual, real `normalizeMenuBlob()` and feeds it a raw payload shaped
exactly like a product going from **zero** tiers to its **first** tier
added (the exact repro this report describes) — the new tier is correctly
attached, a second unrelated product is correctly unaffected, and the
before-state correctly shows the fallback. **6/6 real assertions pass.**
This function was not the problem.

### The fix

`app/api/menu/route.ts`'s `Cache-Control` header changed from:

```
public, max-age=300, s-maxage=300
```

to:

```
public, max-age=0, s-maxage=300, must-revalidate
```

`max-age=0` makes a customer's browser treat the response as immediately
stale, so it issues a real request every time — which is what lets
`purgeMenuCache`'s already-correct server-side purge actually take effect
for that customer's very next load. `s-maxage=300` is left unchanged, so
the **edge** (Cloudflare's `caches.default`, purged instantly by every
admin write) still avoids re-querying D1 on every single customer
request — the original performance goal of this cache is preserved;
only the part that was silently defeating it (the browser skipping the
network layer entirely) is fixed.

**Real verification, not just HTTP-semantics assertion:**
`worker/test-data/size-tier-bugfix-cache-verify.js` extracts the actual
`Cache-Control` string shipped in `route.ts` (regex, not hand-copied) and
runs it through a correct implementation of RFC 9111 §4.2.1's
freshness-lifetime calculation, computed separately for a shared cache
(what the edge behaves as — honors `s-maxage`) and a private cache (what
a browser behaves as — always uses `max-age`, ignores `s-maxage`). It
proves, with the exact old and new header strings: before the fix, a
browser's freshness lifetime was 300s (the bug); after the fix, it's 0s
(fixed) while the edge's stays 300s (perf preserved). **5/5 assertions
pass.**

### What this does NOT fix (a real, disclosed residual limitation)

Cloudflare's Workers Cache API (`caches.default`, used here) is a
**per-datacenter** cache. `purgeMenuCache`'s `cache.delete()` only clears
the copy at whichever colo handled the admin's specific write request. A
customer whose request lands on a **different** colo within the
following 5 minutes could still receive that colo's own not-yet-expired
cached response. This header fix guarantees every customer's browser
always asks a server for a fresh check (closing the deterministic,
always-reproducible half of the bug); it does not guarantee every
Cloudflare colo agrees on the answer within the same instant (a residual,
much rarer, geography-dependent staleness window of up to 5 minutes in
the worst case). Closing that fully would mean moving off the Workers
Cache API entirely — e.g. a version-tagged KV/R2 cache with real global
invalidation — a materially bigger architectural change than this bug
report's scope, so it wasn't undertaken here. Flagging it rather than
quietly leaving it undocumented, per the brief's own "or documenting that
a short delay is expected, if intentional" option.

### Files changed

- `app/api/menu/route.ts` — the one-line `Cache-Control` fix, with the
  reasoning written in place as a comment.

### Not changed (confirmed unnecessary)

- `components/admin/SizesEditor.tsx` and every admin-side save path — the
  brief's own instruction was "don't change the admin-side UI/save
  behavior unless the actual bug is there." It wasn't — every admin write
  already calls `purgeMenuCache` correctly.
- `lib/menu-i18n.ts` — proven correct by real execution (harness above),
  not touched.

---

## Task 2 — Size selector: always-visible buttons instead of a collapsed dropdown

### What changed

`components/ProductPage.tsx` gained a new, dedicated component,
`SizeTierButtons`, used **only** for the `'size'` option-group kind.
`BottomRow` (the collapsed "current choice + tap to change" pattern) is
completely untouched and still drives base/sauce/cheese/etc. exactly as
before.

- **Always-visible buttons**, one per tier, laid out with CSS flexbox
  (`.pp-size-tiles` / `.pp-size-tile` in `globals.css`, mirrored in
  `app/globals.css`): `flex: 1 1 calc(50% - 5px)` on each tile means two
  short-labeled tiles sit side by side, and a third (or any odd one out)
  wraps to its own row and grows to fill that row's full width — matching
  the confirmed layout (2 across, 1 full-width below) with plain CSS, no
  JS row-chunking needed.
- **The currently-selected tile is visually marked** with an `.active`
  class (filled ember background), the same visual language the old M/L
  toggle used for its own active state.
- **Price display**: each tile shows its **resulting absolute price**
  (e.g. "Perhe — 14.50 €"), not a "+X.XX €" delta. The old M/L toggle
  could use a delta badge because there were only ever two fixed, known
  tiers (Medium was always literally the base price). A per-product
  ladder can have any number of tiers with no fixed "this one's the base"
  convention a customer would recognize on sight (Normaali/Pannu/Perhe,
  for instance) — showing exactly what they'll pay for each tier is
  unambiguous regardless of tier count or which one happens to be
  cheapest, and matches how food-ordering UIs conventionally present size
  buttons. This choice (and the reasoning) is written in place as a
  comment on `SizeTierButtons` itself.
- **A product with no real `'size'` group still shows no size row at
  all** — a new `hasRealSizeTiers` check distinguishes a genuine,
  admin-configured group (any tier count, even just one) from the
  synthetic single-entry `FALLBACK_OPTION` every unconfigured option kind
  already falls back to. Only the former renders the row; this is a
  deliberate change from `BottomRow`'s own convention (which always shows
  *something*, even "Default"), specifically requested by this brief.

### Files changed

- `components/ProductPage.tsx` — new `SizeTierButtons` component, new
  `hasRealSizeTiers` check, size section now conditionally rendered using
  it instead of always rendering `BottomRow`.
- `globals.css` (the stylesheet the customer-facing site actually loads)
  and `app/globals.css` (its admin-loaded mirror, kept in sync per this
  project's existing convention for these two files) — `.pp-size-tiles`/
  `.pp-size-tile`/`.pp-size-tile-label`/`.pp-size-tile-price` added.

### How this was verified

No live browser/Cloudflare/D1 available in this sandbox (same infra gap
as every prior delivery on this project). What **is** real: `SizeTierButtons`
and `hasRealSizeTiers` are internal (non-exported) helpers inside
`ProductPage.tsx`, same as every other helper component in that file
(`BottomRow`, `SauceStripeRow`, etc.) — so
`worker/test-data/size-tier-buttons-ui-verify.js` extracts their **exact,
real source** straight out of the shipped file (brace-matched, not
hand-retyped) and executes it for real via `ReactDOMServer.renderToStaticMarkup`:

- A 3-tier case (Normaali/Pannu/Perhe, mirroring the brief's own
  worked example) renders exactly 3 buttons, all three labels present,
  each showing the correct absolute price (8.00 € / 11.00 € / 14.50 €),
  and the currently-selected tile — and only that one — carries the
  `active` class.
- A 2-tier case renders exactly 2 buttons with correct prices (11.00 € /
  15.75 €).
- The zero-tier case is proven by `hasRealSizeTiers` correctly returning
  `false` for the exact `FALLBACK_OPTION` shape (so `ProductPage.tsx`'s
  `{hasRealSizeTiers && (...)}` never even calls `SizeTierButtons` in that
  case — nothing further to render-test).
- A real single-tier admin-configured group (not the fallback) is
  correctly still treated as real, not confused with the fallback.

**14/14 assertions pass.** Every touched file also passed an individual
strict-TypeScript syntax check (`ts.transpileModule({ strict: true })`,
0 diagnostics).

### What wasn't independently re-verified

Full in-browser visual confirmation of the flex-wrap layout (the "2 across,
1 full-width below" behavior) — this is standard, well-understood CSS
flexbox behavior (`flex-grow: 1` on a lone leftover item in its own flex
line fills that line's remaining space), traced and explained in the CSS
comment, but not screenshotted, since no browser is available in this
sandbox.

---

## Running the new tests yourself

```
node worker/test-data/size-tier-bugfix-cache-verify.js
node worker/test-data/size-tier-bugfix-menu-i18n-harness.js
node worker/test-data/size-tier-buttons-ui-verify.js
```
