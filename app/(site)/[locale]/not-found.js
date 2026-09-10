'use client';

import { useTranslations, useLocalePath } from '@/lib/i18n';

// Bug-fix (build failure, Sept 2026): a root-level app/not-found.js was
// added here first (by a previous fix attempt) on the theory that Next.js
// requires one whenever a project defines a custom root layout. That's
// true, but only when the "root layout" is a single app/layout.js at the
// true root — this project deliberately has NO such file; instead it has
// two separate top-level layouts via route groups
// (app/(site)/[locale]/layout.js and app/admin/layout.js), which is a
// different, valid Next.js pattern. A not-found.js sitting above BOTH of
// those groups has no root layout to attach to at all, which is exactly
// what broke the build: "not-found.js doesn't have a root layout."
//
// The fix is to put not-found.js INSIDE the route group that needs it
// (here) instead of at the true root — Next.js's own docs cover this
// exact multiple-root-layouts case. This file inherits
// app/(site)/[locale]/layout.js's <html>/<body> and header/footer, so —
// unlike the root-level attempt — it must NOT redeclare <html>/<body>
// itself, and useTranslations()/useLocalePath() work normally here via
// useParams(), same as app/(site)/[locale]/error.js.
export default function NotFound() {
  const t = useTranslations();
  const lp = useLocalePath();

  return (
    <div
      style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px' }}>{t.notFound.heading}</p>
      <p style={{ color: '#6b6b6b', margin: '0 0 24px', maxWidth: 340 }}>{t.notFound.body}</p>
      <a
        href={lp('/')}
        style={{ background: '#FF6A3D', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
      >
        {t.notFound.goHome}
      </a>
    </div>
  );
}
