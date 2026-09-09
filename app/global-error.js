'use client';

import { useEffect, useState } from 'react';
import en from '@/lib/i18n/en';
import fi from '@/lib/i18n/fi';

// This replaces the ENTIRE root layout when something above it throws —
// including app/(site)/[locale]/layout.js itself — so it can't safely
// rely on the [locale] route param being available (useParams()/
// useTranslations() assume a working router tree). Detecting the
// language from the URL path directly, client-side only, is a simpler,
// more robust fallback for this one error-boundary page.
function detectLocale() {
  if (typeof window === 'undefined') return 'fi';
  return window.location.pathname.startsWith('/en') ? 'en' : 'fi';
}

export default function GlobalError({ error, reset }) {
  const [locale, setLocale] = useState('fi');

  useEffect(() => {
    // Log to the console so it's still inspectable during development,
    // without leaving the customer staring at a raw stack trace.
    console.error(error);
    setLocale(detectLocale());
  }, [error]);

  const t = (locale === 'en' ? en : fi).error;
  const homeHref = `/${locale}`;

  return (
    <html lang={locale}>
      <body>
        <div
          style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 24, textAlign: 'center', background: '#17110D', color: '#F4E9DA',
            fontFamily: 'sans-serif',
          }}
        >
          <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px' }}>{t.heading}</p>
          <p style={{ color: '#B8A99C', margin: '0 0 24px', maxWidth: 340 }}>
            {t.body}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ background: '#FF6A3D', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              {t.tryAgain}
            </button>
            <a
              href={homeHref}
              style={{ background: 'none', color: '#F4E9DA', border: '1px solid #3A2B21', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
            >
              {t.goHome}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
