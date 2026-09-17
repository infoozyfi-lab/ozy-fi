'use client';

// Small dependency-free i18n helper — see lib/i18n/fi.js's header comment
// for why this project doesn't reach for a full i18n library. `fi`/`en`
// are plain nested objects (with the occasional function value for
// strings that need interpolation, e.g. a price or a count), so
// "translating" a component is just: call useTranslations(), then read
// t.section.key instead of a hardcoded English string.
//
// This file is 'use client' because useTranslations()/useLocale()/
// useLocalePath() call next/navigation's useParams(), a client-only
// hook — so this whole module is a client boundary. Server Components
// (page.js generateMetadata/bodies) should import getDictionary and
// everything else from './locales' instead (re-exported below only for
// Client Components' convenience) — see lib/i18n/locales.js's header
// comment for why that split matters.

import { useParams } from 'next/navigation';
import { DEFAULT_LOCALE, isLocale } from './locales';

export {
  LOCALES, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, swapLocaleInPath,
  resolveText, hreflangAlternates, getDictionary,
} from './locales';
import { getDictionary } from './locales';

// Client Component hook — reads the current `[locale]` route segment via
// useParams() so components never need `locale` threaded through props by
// hand. Falls back to the default locale if, for any reason, this renders
// outside the `[locale]` segment (shouldn't happen for customer-facing
// pages, but keeps this from ever throwing).
export function useTranslations() {
  const params = useParams();
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE;
  return getDictionary(locale);
}

// Same idea, but just the locale string — for components that need to
// know which language is active without pulling in the whole dictionary
// (e.g. to resolve name_fi/name fallbacks on menu data, or to build a
// locale-prefixed href).
export function useLocale() {
  const params = useParams();
  return isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE;
}

// Client Component helper — turns an unprefixed, "old-style" app path
// (`/menu`, `/product/abc`, `/`, `/track`) into the current locale's real
// route (`/fi/menu`, `/en/product/abc`, `/fi`, `/fi/track`). Every Link
// href and router.push/pushState call in the customer-facing app should
// go through this instead of hardcoding a bare path — that's what makes
// the language switcher (and just normal navigation) stay on the same
// language instead of silently falling back to Finnish mid-visit.
export function useLocalePath() {
  const locale = useLocale();
  return (path: string) => {
    if (!path || path === '/') return `/${locale}`;
    // Leave anchors/hashes on the current page (e.g. "#story") and
    // absolute external / API links alone — only app routes get prefixed.
    if (path.startsWith('#') || path.startsWith('http') || path.startsWith('mailto:') || path.startsWith('tel:')) {
      return path;
    }
    // A path that already starts with "/#" (e.g. "/#story", used from the
    // product/checkout overlays to get back to a homepage anchor) becomes
    // "/fi#story" — still a real, locale-correct link to the homepage.
    if (path.startsWith('/#')) return `/${locale}${path.slice(1)}`;
    return `/${locale}${path}`;
  };
}
