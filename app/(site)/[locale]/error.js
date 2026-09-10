'use client';

import { useEffect } from 'react';
import { useTranslations, useLocalePath } from '@/lib/i18n';

// Bumped every time this file changes, so a screenshot immediately shows
// whether the currently-deployed code is actually this version or an
// older/stale one — see the DEBUG_BUILD banner below. Change this string
// whenever you edit this file for a diagnostic round.
const DEBUG_BUILD = 'DEBUG-BUILD-3 (not-found.js relocated + version banner) — 2026-09-10';

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
// swaps to this message, and — critically — the real error is logged to
// the console (and therefore to `wrangler tail` / Cloudflare Worker logs)
// with a stack trace instead of being swallowed by the time it reaches
// global-error.js.
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
      {/* Unmissable version banner — deliberately the FIRST thing on the
          page, above the normal error text, so it's visible even without
          scrolling. If a screenshot of this page does NOT show this
          banner at all, the code actually running is older than this
          file (a stale build, wrong branch, or a cache) — that's
          diagnostic information on its own. Remove together with the
          debug block below once the bug is confirmed fixed. */}
      <div style={{ background: '#FFD400', color: '#000', fontWeight: 700, fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
        {DEBUG_BUILD}
      </div>
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

      {/* TEMPORARY DEBUG BLOCK (added Sept 2026) — deliberately shown in
          production, not just dev, because `wrangler tail` (OAuth login
          times out on this mobile-only Codespaces setup) and the
          Cloudflare dashboard's live Logs stream have both failed to
          surface the real error, twice. Screenshotting this block is the
          fallback way to get the actual message/digest/stack off the
          screen with no terminal or dashboard needed.
          NOTE: if this error originated during server-side rendering,
          Next.js may replace `error.message` with a generic production
          message and only keep `error.digest` real (this is intentional
          Next.js behavior — it redacts server error details by default so
          they don't leak to visitors) — the digest is still a useful
          clue even then. A client-side-only error (thrown after
          hydration) will show its full real message here.
          REMOVE THIS BLOCK once the underlying bug is found, fixed, and
          confirmed stable on a real deploy — it should not stay visible
          to real customers once ssr-migration goes live as production. */}
      <pre
        style={{
          marginTop: 20, padding: 12, background: '#f5f5f5', color: '#900', fontSize: 12,
          maxWidth: '90vw', overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap',
          border: '1px solid #d99', borderRadius: 6,
        }}
      >
        {'message: '}{error?.message || '(none)'}
        {error?.digest ? `\ndigest: ${error.digest}` : '\ndigest: (none)'}
        {error?.stack ? `\n\nstack:\n${error.stack}` : ''}
      </pre>
    </div>
  );
}
