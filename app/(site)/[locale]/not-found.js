'use client';

import { useEffect, useState } from 'react';

// Bug-fix history (bilingual-site crash investigation, Sept 2026):
// this file used to live at app/not-found.js (the true app root). That
// broke the Cloudflare build: a ROOT not-found.js needs to compose with
// an actual root app/layout.js, and this project deliberately has none
// (it was deleted when the bilingual work split it into two separate
// root layouts via route groups — app/(site)/[locale]/layout.js and
// app/admin/layout.js — see that layout's header comment). Moving this
// file here, under the (site)/[locale] group, fixed the build: it now
// nests inside app/(site)/[locale]/layout.js like any other page in this
// segment, instead of trying to exist above both root layouts.
//
// This covers BOTH cases: an explicit notFound() call from this
// segment's pages (invalid locale, a missing category slug, a missing
// product id) AND an implicit 404 for any /fi/... or /en/... path that
// doesn't match a real route (e.g. /fi/some-garbage-url) — Next.js walks
// up from the closest matched segment looking for a not-found.js, and
// this is now the first one it finds.
//
// Not using useParams()/useTranslations() here — not-found.js's access
// to route params has been inconsistent across Next.js 14 point
// releases, so this uses the same robust, proven client-side
// URL-path-detection pattern as app/global-error.js instead. No
// <html>/<body> tags here (unlike global-error.js) — this nests INSIDE
// app/(site)/[locale]/layout.js, which already provides them.
function detectLocale() {
  if (typeof window === 'undefined') return 'fi';
  return window.location.pathname.startsWith('/en') ? 'en' : 'fi';
}

const COPY = {
  fi: { heading: 'Sivua ei löytynyt', body: 'Etsimääsi sivua ei ole olemassa tai se on siirretty.', goHome: 'Etusivulle' },
  en: { heading: 'Page not found', body: "The page you're looking for doesn't exist or has moved.", goHome: 'Go to homepage' },
};

export default function LocaleNotFound() {
  const [locale, setLocale] = useState('fi');

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = COPY[locale];

  return (
    <div
      style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px' }}>{t.heading}</p>
      <p style={{ color: '#6b6b6b', margin: '0 0 24px', maxWidth: 340 }}>{t.body}</p>
      <a
        href={`/${locale}`}
        style={{ background: '#FF6A3D', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
      >
        {t.goHome}
      </a>
    </div>
  );
}
