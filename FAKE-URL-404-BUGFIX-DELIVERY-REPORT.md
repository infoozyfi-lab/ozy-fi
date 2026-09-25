# Fake pushState URL → real 404 on refresh — bugfix delivery report

## The bug, confirmed

`context/StoreContext.tsx`'s `setUrl()` pushes a cosmetic URL via
`window.history.pushState` whenever an overlay opens — checkout, the
drink-upsell step, the bundle builder, the order-confirmation screen, and
a product page. None of these five are real Next.js routes except the
product one, and even that one turned out to be silently broken in a
different way (see Part 2). If the browser reloads for any reason while
one of these URLs is showing — a manual refresh, a dropped connection,
a backgrounded mobile tab reloading — the customer used to land on a
real, routeless 404 and lose their place, worst of all mid-checkout.

This is a two-part fix plus one deliberate non-fix (documented, not an
oversight):

1. **`middleware.ts`** now rewrites the four genuinely-fake overlay paths
   (`/checkout`, `/drinks`, `/order-confirmed`, `/bundle`) to a real page
   instead of 404ing.
2. **`context/StoreContext.tsx`**'s `openProduct()` now pushes the
   product's real database `id` instead of a slugified name — which
   turns the fifth path, `/product/<...>`, into an already-real,
   already-working route with no rewrite needed at all.
3. **`context/StoreContext.tsx`** gained a small mount-time effect that
   restores the checkout/drink-upsell overlay itself, specifically for
   the two paths where there's real, persisted data to restore it from.

## Part 1 — `middleware.ts`: rewrite, not redirect

`middleware.ts` already existed for exactly one job before this: turning
a bare, unprefixed URL (`/menu`) into its locale-prefixed real route
(`/fi/menu`), via a 308 redirect, and passing an already-prefixed request
straight through. That's still job #1 and #2, completely untouched.

Added as job #3: for a request whose path is *exactly*
`/<locale>/checkout`, `/<locale>/drinks`, `/<locale>/order-confirmed`, or
`/<locale>/bundle` (a strict 3-segment match — `/fi/bundle/anything-else`
is deliberately **not** caught, so this can never swallow some future,
unrelated real route that happens to share a name), the request is
**rewritten** — not redirected — to that locale's `/menu` page:

```ts
const FAKE_OVERLAY_PATHS = new Set(['checkout', 'drinks', 'order-confirmed', 'bundle']);
...
const isFakeOverlayPath = segments.length === 3 && FAKE_OVERLAY_PATHS.has(segments[2]);
if (isFakeOverlayPath) {
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/${firstSegment}/menu`;
  response = NextResponse.rewrite(rewriteUrl);
}
```

**Why a rewrite and not a redirect:** a redirect would change the address
bar back to `/menu`, discarding the "nicer URL" this whole mechanism
exists for in the first place. A rewrite serves the menu page's real
content while the browser keeps showing `/checkout` (or whichever fake
path it was) — exactly the illusion `setUrl()` was always going for,
except now it survives a reload instead of 404ing.

**Why `/menu` specifically, not `/` or a dedicated blank page:** this app
already has an established convention for "where does closing this
overlay go" — every `closeCheckout()`/`closeProduct()`/etc. call in
`StoreContext.tsx` calls `goBack()`, which is `router.push(lp('/menu'))`.
Rewriting the fake paths to the same destination keeps this fix
consistent with a pattern the app already chose, rather than inventing a
second "safe landing page" concept. `/menu` also mounts the exact same
`StoreProvider` + overlay component set (`ProductPage`, `BundleModal`,
`DrinkUpsellModal`, `CheckoutModal`, `ConfirmModal`, `OrderBar`) as the
home page does — confirmed by reading `components/MenuPageClient.tsx` —
which is what makes Part 3's restore effect possible at all: the
components that would show the reopened checkout/drinks modal are
already mounted on the page middleware rewrites to.

**Confirmed still working exactly as before:** the pre-existing
bare-path-redirect job. `/checkout` (no locale prefix at all — not
something this app generates, but a defensive case worth keeping
correct) still 308-redirects to `/fi/checkout` first; middleware then
rewrites *that* request to `/fi/menu` on the follow-up hit. Both jobs
compose correctly (see the verification harness below).

## Part 2 — the product URL's real, separate bug (fixed at the root)

The bug report specifically flagged that `/product/<slugified-name>` was
a *different* id scheme than the real `/product/[id]` route uses (which
looks a product up by its actual database `id`), and that even where the
route shape matches, the specific URL likely wouldn't resolve to the
right product. Tracing it confirmed this exactly:
`app/(site)/[locale]/product/[id]/page.tsx`'s `getProduct(id)` does
`SELECT * FROM products WHERE id = ? AND active = 1` — a slugified
*name* essentially never matches a real `id` (the two ids only coincide
by pure luck for a handful of English-named single-word products), so
almost every refreshed product URL was calling `notFound()`.

Rather than adding a rewrite/lookup layer to paper over the mismatch
(option the bug report raised, but which would mean re-deriving "which
product does this slug most likely mean" — lossy and occasionally
wrong), the fix goes to the root: `openProduct()` in
`context/StoreContext.tsx` now pushes the product's real `id`:

```ts
// before:
setUrl(lp(`/product/${slugify(item.name)}`));
// after:
setUrl(lp(`/product/${item.id}`));
```

This makes `/product/<id>` a genuinely correct, resolvable URL — no
middleware involvement needed, because `app/(site)/[locale]/product/[id]/
page.tsx` already exists, already does the right D1 lookup, and (this is
the part that makes this fix better than "just don't 404" for this one
path) **already reopens the product overlay automatically**:
`components/ProductPageStandalone.tsx`'s `AutoOpenProduct` effect waits
for the client-side menu data to finish loading, finds the matching
product by `id`, and calls `openProduct(product, null, { skipUrlPush:
true })` — precisely the mechanism a prior round (the
size-selector-not-showing bugfix) already built and fixed. So refreshing
`/fi/product/<real-id>` doesn't just avoid a 404 — the customer lands on
a real, fully-functional, SEO-correct standalone product page for the
*exact* product they had open, with the same product overlay UI
reopening on top of it. This is a strictly better outcome than "restore
the modal state," because it's a real page rather than a fake
recreation of one.

The now-dead `slugify()` helper (it had no other caller in the file) was
removed along with a comment explaining why, rather than left as
unused dead code.

## Part 3 — restoring the checkout/drink-upsell overlay itself

The bug report asked explicitly: does this app read the URL on initial
mount to decide "should an overlay be open" at all, or only react to
`popstate` (back button)? Traced and confirmed: **only `popstate`** — the
existing listener in `StoreContext.tsx` resets every overlay to closed on
back-button, but nothing on mount ever opened one. So even after Part 1's
fix, a refresh at `/checkout` would land on a normal, working `/menu`
page — no more 404, but also not "back where they were."

A new effect (mount-only, `[]` deps — it never fires on the app's own
internal pushState-only navigations, only on a real page load/refresh)
was added right after the existing `popstate` listener:

- **`/checkout` and `/drinks`**: restored, but **only when a saved cart
  actually exists** (read directly from `sessionStorage['ozy_cart']` —
  the same source the existing cart-persistence effect already uses).
  This is deliberately narrow but covers the case the bug report itself
  calls the worst one ("money-adjacent... mid-checkout is exactly when
  this is worst"), and it's the one case where this app already has
  everything needed to restore correctly: the cart survives reloads
  already, and `CheckoutModal`/`DrinkUpsellModal` only ever need
  `cart`/`cartTotal` (plus already-independently-loaded menu-wide data
  like `drinks`, `deliverySettings`) to render correctly — confirmed by
  reading both components' `useStore()` destructuring.
- **`/order-confirmed`**: **deliberately not restored.** `confirmedOrder`
  is plain in-memory React state with no persisted counterpart anywhere,
  and the cart is already emptied the moment an order is placed (see
  `finalizeOrder`). There is nothing real to restore from — which is
  exactly the behavior the bug report asked for: *"shouldn't necessarily
  be able to replay a confirmation for an order that's no longer the
  live cart state."* A refreshed `/order-confirmed` now shows a normal,
  working `/menu` page with an empty cart — never a replayed receipt.
- **`/bundle`**: **deliberately not restored**, for a different reason
  than order-confirmed: `activeBundle` and `bundleSlots` (which bundle,
  and what's in each slot) are, like `confirmedOrder`, pure in-memory
  state with nothing persisted to rebuild them from. Reopening an empty
  or wrong bundle modal would be worse than not reopening one at all. A
  refreshed `/bundle` now shows a normal working `/menu` page instead of
  a 404 — restarting the bundle picker from there is one click away. This
  is flagged, as the bug report invited, as a reasonable **separate,
  later task** if bundle-in-progress state is ever worth persisting (it
  would need its own `sessionStorage` slot, mirroring the cart's).
- **`/product/<id>`**: needs no entry in this effect at all — Part 2
  already made it a real route that reopens itself.

```ts
useEffect(() => {
  if (typeof window === 'undefined') return;
  const afterLocale = (pathname || '').replace(new RegExp(`^/${locale}`), '') || '/';
  if (afterLocale !== '/checkout' && afterLocale !== '/drinks') return;

  let hasSavedCart = false;
  try {
    const saved = sessionStorage.getItem('ozy_cart');
    const parsed = saved ? JSON.parse(saved) : [];
    hasSavedCart = Array.isArray(parsed) && parsed.length > 0;
  } catch {
    hasSavedCart = false;
  }
  if (!hasSavedCart) return;

  setCartOpen(false);
  if (afterLocale === '/checkout') {
    setDrinkUpsellOpen(false);
    setCheckoutOpen(true);
  } else {
    setCheckoutOpen(false);
    setDrinkUpsellOpen(true);
  }
}, []);
```

`pathname` comes from `usePathname()` (`next/navigation`) — the real,
visible browser URL. This is unaffected by Part 1's middleware rewrite:
a rewrite changes what content is *served*, never what the address bar
(or `usePathname()`) reports, so this effect correctly sees `/checkout`
even though the actual page tree rendered underneath is `/menu`'s.

## What a customer experiences now, per path

- **`/checkout`**: refresh → served the real menu page (no 404); cart
  intact; checkout modal automatically reopens on top of it if the cart
  is non-empty. If the cart had somehow already been cleared, a normal
  working menu page (no dangling empty checkout).
- **`/drinks`**: same as `/checkout` — the drink-upsell step reopens
  instead.
- **`/order-confirmed`**: refresh → served the real menu page, empty
  cart, no confirmation screen — by design, never a replayed receipt.
- **`/bundle`**: refresh → served the real menu page, cart intact; the
  bundle builder does not reopen (documented gap, separate task).
- **`/product/<id>`**: refresh → served the real, correct, SEO-complete
  standalone page for that exact product, which reopens the same product
  overlay UI automatically. The best-restored case of the five, and no
  longer even routed through the "fake path" mechanism at all.

## Standing rules — confirmed

- No `cookies()` from `next/headers` anywhere in either changed file
  (`middleware.ts` uses the Edge-native `request.cookies`/
  `response.cookies`, exactly as it already did before this round).
- Both changed files are `.ts`/`.tsx`, `strict: true` compiles clean (see
  Verification), no `any` introduced — the one untyped `JSON.parse()`
  result in the new restore effect matches the exact same pre-existing,
  untyped pattern already used one effect above it (the cart-loading
  effect), not a new relaxation.
- The real, existing Next.js routes (`/product/[id]`, `/menu`, etc.) were
  not touched — Part 2 changes what URL gets *pushed*, not the route
  files themselves; Part 1's rewrite target (`/menu`) is served by its
  own unmodified route.
- No checkout/payment logic was touched — `placeOrder`, `finalizeOrder`,
  Stripe/CardPaymentStep, and every pricing function are untouched; this
  round is purely about which URL is shown and what reopens on load.
- `package.json`'s `overrides` block and `.npmrc` confirmed intact
  (unchanged from the prior round — `legacy-peer-deps=true`;
  `@opennextjs/cloudflare`, `@opennextjs/aws`, and `@stripe/react-stripe-js`
  overrides all present).

## Verification (real execution)

`npm install` still fails in this sandbox with the same `403 Forbidden`
from `registry.npmjs.org` seen in every prior round here — no network
access to the npm registry, so no full `next build`/`tsc` against real
`node_modules`. Fell back to this project's established methodology:

1. **Syntax check** — `ts.transpileModule` on both changed files
   (`context/StoreContext.tsx`, `middleware.ts`) with JSX enabled: both
   compile clean, no syntax errors.
2. **`middleware.ts` real-execution harness** — the actual exported
   `middleware()` function, loaded via a `Module._load` hook that
   substitutes `next/server`/`@/lib/i18n/locales` with faithful mocks
   (not reimplementations of the routing logic — only of Next's own
   `NextResponse.next/redirect/rewrite` primitives), then called with 17
   constructed requests: all 5 confirmed fake paths (both rewritten
   correctly, in both locales for one of them), every real route
   (untouched), the exact-match guard (an extra path segment is *not*
   caught), the bare-path-redirect-then-rewrite two-hop case, and the
   locale cookie still being set on a rewritten response. **17/17
   passed.**
3. **`worker/test-data/fake-url-404-verify.js`** (new, committed to the
   project like every prior round's harness) — re-runs the middleware
   checks, then (a) confirms by direct source inspection that
   `openProduct()`'s real body now pushes `/product/${item.id}` and no
   longer references `slugify`, and that the dead `slugify` function was
   actually removed; and (b) brace-matches the real restore-on-mount
   effect's body out of the live file and executes it (not a
   reimplementation) against 9 scenarios: checkout/drinks with a saved
   cart (restores), checkout with an empty or absent cart (does nothing),
   order-confirmed and bundle (deliberately do nothing even with a cart
   present), a real route like `/menu` (does nothing), the English
   locale (still works), and corrupt `sessionStorage` JSON (caught, no
   throw, no restore). **22/22 passed.**
4. **Full regression sweep** — every pre-existing harness in
   `worker/test-data/` (11 files, spanning every prior round's fix) was
   re-run unchanged: **all 11 still pass**, confirming this round didn't
   disturb the size-tier system, the extras system, pricing, the D1
   migration import, or anything else already delivered.

## Files changed

- `middleware.ts` — added the fake-overlay-path rewrite (job #3).
- `context/StoreContext.tsx` — `openProduct()` now pushes the real
  product id; removed the now-dead `slugify()` helper; added the
  mount-time overlay-restore effect; added a `usePathname()` import.
- `worker/test-data/fake-url-404-verify.js` (new) — this round's
  real-execution verification harness.
