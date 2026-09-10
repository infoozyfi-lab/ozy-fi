'use client';

import { useEffect, useState } from 'react';

// Bug-fix (bilingual-site crash, Sept 2026): this file did not exist
// before. Next.js's own docs require an app/not-found.js at the true
// root whenever a project defines a custom root layout — and this
// project now defines TWO (app/(site)/[locale]/layout.js and
// app/admin/layout.js), ever since the bilingual-site route-group split.
// Without a root not-found.js, Next.js has no defined fallback to attach
// the framework's internal 404 handling to above those layouts, which is
// exactly the kind of gap that behaves fine in `next dev` but can surface
// as an unexpected failure once actually deployed (OpenNext/Cloudflare)
// — consistent with this project's standing rule that this deploy target
// has repeatedly caught issues `next dev` doesn't.
//
// Sits ABOVE both root layouts (same reason app/global-error.js defines
// its own <html>/<body>: nothing above this point guarantees one), so it
// can't use useParams()/useTranslations() — same locale-from-URL fallback
// pattern as global-error.js.
function detectLocale() {
  if (typeof window === 'undefined') return 'fi';
  return window.location.pathname.startsWith('/en') ? 'en' : 'fi';
}

const COPY = {
  fi: { heading: 'Sivua ei löytynyt', body: 'Etsimääsi sivua ei ole olemassa tai se on siirretty.', goHome: 'Etusivulle' },
  en: { heading: 'Page not found', body: "The page you're looking for doesn't exist or has moved.", goHome: 'Go to homepage' },
};

export default function NotFound() {
  const [locale, setLocale] = useState('fi');

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = COPY[locale];

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
          <p style={{ color: '#B8A99C', margin: '0 0 24px', maxWidth: 340 }}>{t.body}</p>
          <a
            href={`/${locale}`}
            style={{ background: '#FF6A3D', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
          >
            {t.goHome}
          </a>
        </div>
      </body>
    </html>
  );
}
