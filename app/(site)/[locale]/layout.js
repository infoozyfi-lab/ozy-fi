import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import '../../globals.css';
import CookieBanner from '@/components/CookieBanner';
import TrackingScripts from '@/components/TrackingScripts';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/locales';

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

export async function generateMetadata({ params }) {
  const { locale } = params;
  return {
    metadataBase: new URL('https://ozy.fi'),
    title: {
      default: locale === 'fi' ? 'ozy.fi — Pizzaa, kebabia ja hampurilaisia' : 'ozy.fi — Pizza, kebab & burgers',
      template: '%s | ozy.fi',
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

async function getRestaurantSchema(locale) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const rows = await env.DB.prepare(
      `SELECT key, value FROM admin_settings WHERE key IN ('restaurant_name', 'phone', 'email', 'address')`
    ).all();
    const s = {};
    for (const r of rows.results) s[r.key] = r.value;

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
      address: s.address ? { '@type': 'PostalAddress', streetAddress: s.address } : undefined,
      servesCuisine: ['Pizza', 'Kebab', 'Burgers'],
      priceRange: '€€',
    };
  } catch {
    // D1 not reachable at build/edge-case time — page still renders fine
    // without structured data rather than failing the whole layout.
    return null;
  }
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = params;

  // A crawler or a stray link hitting an unsupported locale segment
  // (`/de/menu`, `/fr`, …) should 404, not silently render English
  // content at a URL Google would then treat as a separate, unofficial
  // page — every other page under this layout relies on this guard
  // rather than repeating the check itself.
  if (!LOCALES.includes(locale)) {
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
