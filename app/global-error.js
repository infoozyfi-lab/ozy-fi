'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log to the console so it's still inspectable during development,
    // without leaving the customer staring at a raw stack trace.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 24, textAlign: 'center', background: '#17110D', color: '#F4E9DA',
            fontFamily: 'sans-serif',
          }}
        >
          <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px' }}>Something went wrong</p>
          <p style={{ color: '#B8A99C', margin: '0 0 24px', maxWidth: 340 }}>
            That page hit a snag. Please try again — if it keeps happening, head back to the homepage.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ background: '#FF6A3D', color: '#1A0D06', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ background: 'none', color: '#F4E9DA', border: '1px solid #3A2B21', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
            >
              Go to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
