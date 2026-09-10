'use client';

import { useEffect } from 'react';
import { useTranslations, useLocalePath } from '@/lib/i18n';

// Bug-fix (bilingual-site crash, Sept 2026): this file did NOT exist
// before — there was no error.js anywhere under app/(site)/[locale]/, so
// ANY thrown error, anywhere in ANY page's component tree (a bad D1 call,
// a bug in a rarely-hit modal, anything at all), had nowhere to land
// except app/global-error.js — which replaces the ENTIRE <html>/<body>,
// including this layout, the header, the footer, everything. That's why
// the reported crash showed on literally every page: this segment had no
// boundary of its own, so every error escalated all the way to the top.
//
// With this file in place, an error anywhere under a customer-facing page
// is caught HERE instead: the page's own <html>/<body> (from
// app/(site)/[locale]/layout.js) stays intact, only the content area
// swaps to this message, and the real error is still logged to the
// console with a stack trace.
//
// (A temporary on-screen debug block — a visible error.message/digest/
// stack <pre> plus a version banner — lived here during the crash
// investigation, since wrangler tail and the Cloudflare dashboard's Logs
// stream were both unreliable on this project's mobile-only setup. It's
// been removed now that the root causes are fixed and confirmed stable;
// showing a raw stack trace to real customers isn't appropriate once
// ssr-migration is live. If a future issue needs this again, the pattern
// is: a `const DEBUG_BUILD = '...'` banner above the buttons, and a
// `<pre>` below them rendering error?.message / error?.digest /
// error?.stack.)
//
// This is a Client Component (Next.js requires error.js to be one), but
// it's safely inside the [locale] segment (unlike global-error.js), so
// useTranslations()/useLocalePath() work normally here via useParams().
export default function LocaleError({ error, reset }) {
  const t = useTranslations();
  const lp = useLocalePath();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app/(site)/[locale]/error.js] caught:', error?.message, error?.digest, error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px' }}>{t.error.heading}</p>
      <p style={{ color: '#6b6b6b', margin: '0 0 24px', maxWidth: 340 }}>{t.error.body}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{ background: '#FF6A3D', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          {t.error.tryAgain}
        </button>
        <a
          href={lp('/')}
          style={{ background: 'none', border: '1px solid #3A2B21', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
        >
          {t.error.goHome}
        </a>
      </div>
    </div>
  );
}
