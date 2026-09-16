import type { Locale } from '@/lib/types';
import fi from './fi';
import en from './en';

// Bilingual site (Finnish primary + English) — shared locale constants.
// Kept dependency-free (no i18n library) per this project's established
// preference for small, native-API implementations — see lib/totp.js,
// lib/adminAuth.js for the same philosophy applied to crypto instead of
// text.
//
// Deliberately NOT 'use client' — unlike lib/i18n/index.js (which needs
// it for the useTranslations()/useLocale() hooks), everything in this
// file is plain, hook-free logic. That matters: Server Components (every
// page.js's generateMetadata, and getDictionary() below) import straight
// from THIS file rather than from lib/i18n/index.js, so a Server
// Component calling a plain function never has to cross a 'use client'
// module boundary to do it.

export const LOCALES: Locale[] = ['fi', 'en'];
export const DEFAULT_LOCALE: Locale = 'fi';

export function isLocale(value: unknown): boolean {
  return LOCALES.includes(value as Locale);
}

// The cookie the language switcher (and middleware.js) use to remember a
// visitor's chosen language across visits to the un-prefixed `/`. A plain
// cookie, not next/headers' cookies() — see this project's standing rule
// (cookies() is confirmed broken once deployed on OpenNext/Cloudflare
// Workers) — set via document.cookie client-side or NextResponse.cookies
// server-side, same as everywhere else in this codebase.
export const LOCALE_COOKIE = 'ozy_locale';

// Swap the leading /fi or /en segment of a pathname for `locale`, keeping
// the rest of the path identical — this is what makes the language
// switcher land on the *equivalent* page instead of always the homepage
// (see components/LanguageSwitcher.js).
export function swapLocaleInPath(pathname: string, locale: string): string {
  const parts = pathname.split('/');
  // parts[0] is '' (leading slash), parts[1] is the current locale segment.
  if (parts.length > 1 && LOCALES.includes(parts[1] as Locale)) {
    parts[1] = locale;
    return parts.join('/') || '/';
  }
  return `/${locale}${pathname === '/' ? '' : pathname}`;
}

// Resolve a translatable field to the current locale's value, falling
// back to the always-present default-language value when the Finnish
// translation hasn't been filled in yet (Phase: bilingual site, see
// lib/menu-i18n.js for where this is applied to menu content coming from
// D1). `defaultValue` is whatever the existing, non-suffixed DB column
// already held before this feature — i.e. English today, but this helper
// doesn't hardcode that assumption anywhere.
export function resolveText(defaultValue: unknown, fiValue: unknown, locale: string): string {
  if (locale === 'fi') return (fiValue as string) || (defaultValue as string) || '';
  return (defaultValue as string) || '';
}

// Builds the `alternates.languages` object Next.js metadata (and, via
// sitemap.js's own copy of this shape, the sitemap) turns into <link
// rel="alternate" hreflang="..."> tags — one per real locale plus
// "x-default", pointing crawlers/browsers with no matching language at
// the primary Finnish version rather than leaving it unspecified.
// `path` is the un-prefixed page path ('' for the homepage, '/menu',
// '/product/abc', ...).
export function hreflangAlternates(path: string): Record<string, string> {
  const entries: [string, string][] = LOCALES.map((l) => [l, `/${l}${path}`]);
  entries.push(['x-default', `/${DEFAULT_LOCALE}${path}`]);
  return Object.fromEntries(entries);
}

const DICTIONARIES: Record<Locale, unknown> = { fi, en };

// Safe for both Server and Client Components — pure lookup, no hooks.
// Server Components (page.js generateMetadata/body) should import this
// directly from here, not from lib/i18n/index.js — see the file header.
//
// Typed `any` deliberately (not `typeof fi`/`typeof en`) — every
// consumer of the returned dictionary across this codebase already
// treats it as `t: any` (it's a plain nested-object-of-strings-and-
// interpolation-functions, never modeled as a real Dictionary type),
// so giving it a precise structural type here wouldn't be enforced
// anywhere and risks surfacing pre-existing fi/en content-shape drift
// as a compile error — a content-parity concern, not a types migration
// one.
export function getDictionary(locale: unknown): any {
  return DICTIONARIES[isLocale(locale) ? (locale as Locale) : DEFAULT_LOCALE];
}
