import type { ReactNode } from 'react';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import '../../globals.css';
import CookieBanner from '@/components/CookieBanner';
import TrackingScripts from '@/components/TrackingScripts';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locales';

// Bilingual site (Finnish primary + English) — this is the ROOT layout
// for every customer-facing page (`/fi/...`, `/en/...`): it owns
// <html>/<body>, same as the single app/layout.js this replaced. The
// admin panel is deliberately NOT under this route group — it has its
// own separate root layout (app/admin/layout.js) that stays English-only,
// per the brief ("Admin panel does not need to be bilingual — it's an
// internal tool"). Next.js supports more than one root layout like this
// via route groups (the "(site)" folder here doesn't add to the URL).
//
// Previously CookieBanner/TrackingScripts lived in the single shared root
// layout, so the admin panel loaded them too — that was never
// intentional (staff aren't customers), and moving them here instead of
// duplicating them into app/admin/layout.js fixes that as a side effect.
// Flagged in this feature's delivery summary as a deliberate, minor
// behavior change.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    metadataBase: new URL('https://ozy.fi'),
    // SEO gap-fill, Part B (title-tag audit) — this used to also set
    // `template: '%s | ozy.fi'`. Every page under this layout already
    // writes its own complete, brand-inclusive title in its own
    // generateMetadata (e.g. the homepage's own
    // 'ozy.fi — Pizzaa, kebabia ja hampurilaisia | Kotiinkuljetus ja
    // nouto', or the product page's '<Name> — ozy.fi') — Next.js's
    // title template wraps a CHILD page's plain-string title as
    // `${template.replace('%s', childTitle)}`, so with both in place
    // every single page's real, rendered <title> silently had "ozy.fi"
    // in it TWICE (e.g. "Privacy Policy — ozy.fi | ozy.fi"). `default`
    // alone is kept as the true fallback — used only if some future page
    // under this layout genuinely provides no title of its own — with no
    // template to double up on every page that already writes a full one.
    title: {
      default: locale === 'fi' ? 'ozy.fi — Pizzaa, kebabia ja hampurilaisia' : 'ozy.fi — Pizza, kebab & burgers',
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Audit-fixes brief, Part 7 — maps this codebase's day keys ('mon'..'sun',
// the same values app/admin/dashboard/page.tsx's OPENING_HOURS_DAYS and
// admin_settings.opening_hours already use) to the schema.org DayOfWeek
// enumeration's full URIs, for OpeningHoursSpecification below.
const SCHEMA_DAY_OF_WEEK: Record<string, string> = {
  mon: 'https://schema.org/Monday',
  tue: 'https://schema.org/Tuesday',
  wed: 'https://schema.org/Wednesday',
  thu: 'https://schema.org/Thursday',
  fri: 'https://schema.org/Friday',
  sat: 'https://schema.org/Saturday',
  sun: 'https://schema.org/Sunday',
};

// Same parse rule as lib/site-settings.ts's parseOpeningHoursSetting,
// lib/menu-i18n.ts's normalizeMenuBlob, and app/admin/dashboard/
// page.tsx's own parseOpeningHours — kept as its own small inline copy
// here rather than importing any of those three, matching this
// codebase's existing precedent of a short, independent copy per call
// site (see site-settings.ts's own comment on why) rather than forking
// a settings-page-specific module's shape into this shared root layout.
function parseOpeningHoursForSchema(raw: string | undefined): { day: string; open?: string; close?: string; closed: boolean }[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 7 ? parsed : null;
  } catch {
    return null;
  }
}

async function getRestaurantSchema(locale: string) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    // Typed generic on .all() (defaults to Record<string, unknown>) so
    // r.key/r.value below are usable as a string index/value without
    // further casts. Part 7 adds four more keys to the same lookup:
    // opening_hours/delivery_postal_codes (both already populated by the
    // existing Restaurant Settings / checkout-enforcement code — see
    // app/admin/dashboard/page.tsx and app/api/orders/route.ts) and the
    // new geo_lat/geo_lng pair (below), all read with the same
    // graceful-fallback-if-unset pattern already used for phone/email/
    // address.
    const rows = await env.DB.prepare(
      `SELECT key, value FROM admin_settings WHERE key IN ('restaurant_name', 'phone', 'email', 'address', 'opening_hours', 'delivery_postal_codes', 'geo_lat', 'geo_lng')`
    ).all<{ key: string; value: string }>();
    const s: Record<string, string> = {};
    for (const r of rows.results) s[r.key] = r.value;

    // Business hours as schema.org OpeningHoursSpecification — one entry
    // per day that's actually open (a closed day, or a day with no
    // open/close time set, simply contributes nothing, same as every
    // other optional field here). Emits real per-day hours because
    // admin_settings.opening_hours already stores real per-day hours
    // (Phase 7.7) — nothing here invents a schedule.
    const parsedHours = parseOpeningHoursForSchema(s.opening_hours);
    const openingHoursSpecEntries = (parsedHours || [])
      .filter((d) => !d.closed && d.open && d.close)
      .map((d) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: SCHEMA_DAY_OF_WEEK[d.day],
        opens: d.open,
        closes: d.close,
      }));

    // Delivery area as schema.org areaServed — same comma-separated
    // postal-code/prefix list app/api/orders/route.ts already enforces
    // at checkout and components/DeliveryPageClient.tsx already displays
    // (see either file's comment for what a short, <=3-character entry
    // vs. a full postal code each mean), so this can't drift out of sync
    // with the delivery area the site actually honors.
    const zones = String(s.delivery_postal_codes || '')
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean);

    // Optional map coordinates — there's no existing admin_settings key
    // or admin UI field for these anywhere in this codebase, so nothing
    // is invented here: geo_lat/geo_lng are two new optional Restaurant
    // Settings fields (see SETTINGS_FIELDS in app/admin/dashboard/
    // page.tsx) that only ever produce a `geo` block once an owner
    // actually fills them in; until then this stays omitted, same as an
    // unset phone or address.
    const lat = Number(s.geo_lat);
    const lng = Number(s.geo_lng);
    const hasGeo = !!s.geo_lat && !!s.geo_lng && Number.isFinite(lat) && Number.isFinite(lng);

    // `FI` (Finland) is not looked up from any per-business setting —
    // it's the same fixed constant this codebase already hardcodes
    // elsewhere for this single-country business (e.g. the invoice
    // page's literal "Suomi" country line, and the +358-only phone
    // validation in components/CheckoutModal.tsx), not a business fact
    // read from admin_settings.
    const COUNTRY = 'FI';

    // Schema.org Restaurant — helps Google show a rich result (hours,
    // phone, address) instead of a plain blue link. `inLanguage` lets
    // this be emitted once per locale without the two versions looking
    // like duplicate structured data to a crawler.
    return {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: s.restaurant_name || 'ozy.fi',
      url: `https://ozy.fi/${locale}`,
      inLanguage: locale,
      telephone: s.phone || undefined,
      email: s.email || undefined,
      address: s.address
        ? { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: COUNTRY }
        : undefined,
      geo: hasGeo ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } : undefined,
      hasMenu: `https://ozy.fi/${locale}/menu`,
      areaServed: zones.length
        ? zones.map((zone) => ({ '@type': 'PostalAddress', postalCode: zone, addressCountry: COUNTRY }))
        : undefined,
      openingHoursSpecification: openingHoursSpecEntries.length ? openingHoursSpecEntries : undefined,
      servesCuisine: ['Pizza', 'Kebab', 'Burgers'],
      priceRange: '€€',
    };
  } catch {
    // D1 not reachable at build/edge-case time — page still renders fine
    // without structured data rather than failing the whole layout.
    return null;
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // A crawler or a stray link hitting an unsupported locale segment
  // (`/de/menu`, `/fr`, …) should 404, not silently render English
  // content at a URL Google would then treat as a separate, unofficial
  // page — every other page under this layout relies on this guard
  // rather than repeating the check itself.
  if (!isLocale(locale)) {
    notFound();
  }

  const restaurantSchema = await getRestaurantSchema(locale || DEFAULT_LOCALE);

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        {restaurantSchema && (
          // eslint-disable-next-line react/no-danger
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
          />
        )}
      </head>
      <body>
        {children}
        <CookieBanner />
        <TrackingScripts />
      </body>
    </html>
  );
}
