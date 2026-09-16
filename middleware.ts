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
// Two jobs:
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
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const segments = pathname.split('/');
  const firstSegment = segments[1];

  if (isLocale(firstSegment)) {
    const response = NextResponse.next();
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
