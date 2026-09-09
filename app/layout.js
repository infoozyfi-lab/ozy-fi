import { getCloudflareContext } from '@opennextjs/cloudflare';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import TrackingScripts from '@/components/TrackingScripts';

export const metadata = {
  metadataBase: new URL('https://ozy.fi'),
  title: 'ozy.fi — Pizza, kebab & burgers',
  description: 'ozy.fi — order pizza, kebab or burgers for delivery, pickup or eat-in.',
  alternates: {
    canonical: '/',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

async function getRestaurantSchema() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const rows = await env.DB.prepare(
      `SELECT key, value FROM admin_settings WHERE key IN ('restaurant_name', 'phone', 'email', 'address')`
    ).all();
    const s = {};
    for (const r of rows.results) s[r.key] = r.value;

    // Schema.org Restaurant — helps Google show a rich result (hours,
    // phone, address) instead of a plain blue link. Built from whatever
    // is actually filled in via the admin panel's Restaurant Info tab —
    // no hardcoded placeholder data here.
    return {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: s.restaurant_name || 'ozy.fi',
      url: 'https://ozy.fi',
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

export default async function RootLayout({ children }) {
  const restaurantSchema = await getRestaurantSchema();

  return (
    <html lang="en">
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
