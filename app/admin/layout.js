import '../globals.css';

// Bilingual site (Finnish primary + English) — the admin panel is
// deliberately NOT bilingual (internal tool, per the brief), so it keeps
// its own separate, English-only root layout instead of living under
// app/(site)/[locale]. This replaces the single shared app/layout.js
// this project used to have — Next.js supports more than one root layout
// via route groups/top-level segments like this, each owning its own
// <html>/<body>.
//
// No CookieBanner/TrackingScripts here — those are customer-facing
// (consent banner, GA/Meta/TikTok/Clarity pixels) and never belonged in
// front of restaurant staff. They previously loaded on /admin too, only
// because they lived in the one shared root layout — this is a small,
// deliberate behavior fix that falls out of splitting the layouts,
// flagged in this feature's delivery summary.

export const metadata = {
  title: 'ozy.fi — Admin',
  description: 'ozy.fi staff admin panel.',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function AdminRootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
