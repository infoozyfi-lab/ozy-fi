'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // Phase 7.9 — set only when the account that just logged in with the
  // right password has 2FA turned on. Non-null means "show the code
  // step instead of the password form"; the pending token itself came
  // back from /api/admin/login (see handleLogin) and must be sent back
  // alongside the code — nothing about this step is a real session yet.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // If a valid session already exists, skip the login form instead of
  // making it look like they got logged out. Phase 5b: cookie-only, so
  // there's no sessionStorage fast path anymore — /api/admin/me (reading
  // the httpOnly cookie) is the one and only source of truth for "are we
  // signed in", on every load of this page.
  //
  // This whole check is wrapped so `checking` is *guaranteed* to end up
  // false one way or another — a version of this that let a network
  // hiccup skip straight to `return` without that used to leave the page
  // stuck showing nothing (see /api/admin/me's comment for the story).
  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const res = await fetch('/api/admin/me');
        // res.json() resolves to `unknown` under real fetch typings — cast
        // to the small shape this endpoint actually returns.
        const data = (await res.json().catch(() => ({ authenticated: false }))) as { authenticated?: boolean };
        if (cancelled) return;
        if (data.authenticated) {
          window.location.href = '/admin/dashboard';
          return;
        }
      } catch {
        // Couldn't reach the server to check — fall through to showing
        // the login form rather than hanging on a blank page.
      }

      if (!cancelled) setChecking(false);
    }

    checkExistingSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // Cast only (no .catch() added) — a JSON-parse failure here must
      // still throw and fall into the outer try/catch below, same as before.
      const data = (await res.json()) as { error?: string; twoFactorRequired?: boolean; pendingToken?: string };

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Phase 7.9 — password was correct, but this account has 2FA on:
      // no cookie was set, just a short-lived pendingToken. Show the code
      // step instead of redirecting.
      if (data.twoFactorRequired) {
        setPendingToken(data.pendingToken || null);
        return;
      }

      // Phase 5b: the login response no longer carries a token to store —
      // the httpOnly cookie the response just set is the entire session.
      // The dashboard's own /api/admin/me check (next page load) confirms
      // it from the cookie.
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || 'Invalid code');
        return;
      }

      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#f7f7f7',
      }}
    >
      {checking ? null : (
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ marginBottom: '8px' }}>
          OZY Admin
        </h1>

        <p style={{ marginBottom: '24px', color: '#666' }}>
          {pendingToken ? 'Enter the 6-digit code from your authenticator app.' : 'Sign in to manage your restaurant.'}
        </p>

        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: '#ffe5e5',
              color: '#b00020',
            }}
          >
            {error}
          </div>
        )}

        {pendingToken ? (
          <form onSubmit={handleVerify2fa}>
            <div style={{ marginBottom: '20px' }}>
              <label>Verification code</label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '6px',
                  boxSizing: 'border-box',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  fontSize: '20px',
                  letterSpacing: '4px',
                  textAlign: 'center',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              style={{
                width: '100%',
                padding: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                borderRadius: '8px',
                background: '#111',
                color: '#fff',
                fontSize: '16px',
              }}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => { setPendingToken(null); setCode(''); setError(''); }}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '10px',
                cursor: 'pointer',
                border: 'none',
                background: 'none',
                color: '#666',
                fontSize: '13px',
              }}
            >
              ← Back to login
            </button>
          </form>
        ) : (
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="hello@ozy.fi"
              required
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                boxSizing: 'border-box',
                border: '1px solid #ccc',
                borderRadius: '8px',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                boxSizing: 'border-box',
                border: '1px solid #ccc',
                borderRadius: '8px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '8px',
              background: '#111',
              color: '#fff',
              fontSize: '16px',
            }}
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
        )}
      </div>
      )}
    </main>
  );
}
