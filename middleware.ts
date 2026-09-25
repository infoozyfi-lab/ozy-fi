import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/lib/i18n/locales';

// Bilingual site (Finnish primary + English) — this is the ONE place that
// decides the /fi vs /en split for every customer-facing URL.
//
// IMPORTANT (per this project's standing rules): Next.js Middleware was
// new to this OpenNext/Cloudflare Workers deployment target at the time
// this was written — it has NOT yet been verified to survive the
// OpenNext adapter unchanged on an actual deployed Cloudflare preview.
// This project has repeatedly found that things which work in local
// `next dev` don't always work once deployed. Before this routing is
// considered done, deploy a preview and run (see this feature's summary
// for the exact commands):
//   curl -I https://<preview>/            -> expect 308 to /fi
//   curl -I https://<preview>/menu        -> expect 308 to /fi/menu (an old bookmarked/indexed URL)
//   curl -I https://<preview>/fi/menu     -> expect 200, no redirect
//
// Three jobs:
//   1. A request with no /fi or /en prefix at all (the bare "/", or an
//      old bookmarked/indexed URL like "/menu", "/product/abc", "/track")
//      gets 308-redirected to the locale-prefixed equivalent — the
//      visitor's last-chosen language (the ozy_locale cookie the language
//      switcher and this middleware both write), or Finnish by default
//      for a first-time visit/crawler (brief's recommended option (a):
//      deterministic default rather than guessing from Accept-Language).
//      308 (permanent), not 307, so any SEO equity already built up on
//      the old bare URLs (e.g. https://ozy.fi/menu, indexed before this
//      feature existed) transfers to the new canonical /fi/menu URL
//      instead of being treated as a fresh, unrelated page.
//   2. A request that's already correctly prefixed (/fi/... or /en/...)
//      passes straight through, but has its ozy_locale cookie refreshed
//      to match — so a later visit to the bare "/" remembers the language
//      this visitor was actually just reading, instead of always
//      bouncing back to Finnish.
//   3. Fake-URL-404 bugfix — context/StoreContext.tsx's setUrl() pushes a
//      handful of decorative, non-route paths via pushState for a nicer
//      address bar while an overlay (checkout, the drink-upsell step, the
//      bundle builder, the order-confirmation screen) is open — none of
//      these are real Next.js pages. A customer whose browser reloads
//      (a real refresh, a lost/restored connection, iOS's own occasional
//      background-tab reload) while one of those URLs is showing used to
//      get a genuine, routeless 404 and lose their progress. Below,
//      FAKE_OVERLAY_PATHS is exactly that list (minus `/product/<slug>`,
//      which had a second, separate bug — see setUrl's own comment in
//      StoreContext.tsx — fixed at the source by pushing the product's
//      real id, which the real /product/[id] route already resolves
//      correctly; no rewrite needed for it here). A request that matches
//      one is REWRITTEN (not redirected — the address bar keeps showing
//      the decorative URL, exactly as intended) to that locale's /menu
//      page — the same real page every "close this overlay" action in
//      this app already navigates to (see StoreContext.tsx's goBack()) —
//      so the customer lands on a normal, fully-working page with their
//      cart intact (it's kept in sessionStorage, unaffected by this)
//      instead of a 404. StoreContext.tsx's own mount-time effect then
//      restores the checkout/drink-upsell overlay itself, for the cases
//      where there's real, persisted data to restore it from — see that
//      effect's comment for exactly which paths and why.
const FAKE_OVERLAY_PATHS = new Set(['checkout', 'drinks', 'order-confirmed', 'bundle']);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const segments = pathname.split('/');
  const firstSegment = segments[1];

  if (isLocale(firstSegment)) {
    // Exactly `/<locale>/<one of the fake overlay names>` — deliberately
    // an exact 3-segment match (never a prefix match) so this can never
    // swallow some other, unrelated real route that happens to start the
    // same way, today or in the future.
    const isFakeOverlayPath = segments.length === 3 && FAKE_OVERLAY_PATHS.has(segments[2]);

    let response: NextResponse;
    if (isFakeOverlayPath) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/${firstSegment}/menu`;
      response = NextResponse.rewrite(rewriteUrl);
    } else {
      response = NextResponse.next();
    }
    response.cookies.set(LOCALE_COOKIE, firstSegment, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const targetLocale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const suffix = pathname === '/' ? '' : pathname;

  const url = request.nextUrl.clone();
  url.pathname = `/${targetLocale}${suffix}`;
  url.search = search;

  return NextResponse.redirect(url, 308);
}

export const config = {
  // Everything EXCEPT: the admin panel (deliberately not bilingual — see
  // the brief), API routes, Next.js internals, the R2 image proxy, and
  // the handful of root-level static/metadata files that must keep
  // living at their unprefixed URL (robots.txt, sitemap.xml, the PWA
  // manifest, the app icon).
  matcher: [
    '/((?!api|admin|_next|images|favicon.ico|icon.png|robots.txt|sitemap.xml|manifest.webmanifest).*)',
  ],
};
