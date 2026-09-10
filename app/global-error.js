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

// See app/(site)/[locale]/error.js's identical constant for why this
// exists — bump it whenever this file changes so a screenshot proves
// which version is actually live.
const DEBUG_BUILD = 'DEBUG-BUILD-3 (not-found.js relocated + version banner) — 2026-09-10';

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
          <div style={{ background: '#FFD400', color: '#000', fontWeight: 700, fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
            {DEBUG_BUILD}
          </div>
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

          {/* TEMPORARY DEBUG BLOCK (added Sept 2026) — same reasoning as
              app/(site)/[locale]/error.js's identical block: wrangler
              tail and the Cloudflare dashboard Logs stream have both
              failed to surface the real error on this mobile-only setup,
              twice. If something is still escaping all the way to THIS
              boundary (rather than being caught by the scoped
              app/(site)/[locale]/error.js), seeing it here on-screen
              means an error is happening somewhere even error.js can't
              catch (e.g. in app/(site)/[locale]/layout.js itself, or in
              this global-error.js's own rendering).
              REMOVE THIS BLOCK once the underlying bug is found, fixed,
              and confirmed stable on a real deploy. */}
          <pre
            style={{
              marginTop: 20, padding: 12, background: '#2A1C12', color: '#FFB199', fontSize: 12,
              maxWidth: '90vw', overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap',
              border: '1px solid #5A3B28', borderRadius: 6,
            }}
          >
            {'message: '}{error?.message || '(none)'}
            {error?.digest ? `\ndigest: ${error.digest}` : '\ndigest: (none)'}
            {error?.stack ? `\n\nstack:\n${error.stack}` : ''}
          </pre>
        </div>
      </body>
    </html>
  );
}
