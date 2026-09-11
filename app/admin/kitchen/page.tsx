'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import OrderKanban from '@/components/admin/OrderKanban';
import MyAccountModal from '@/components/admin/MyAccountModal';

export default function KitchenPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Phase 7.9 — same two-step flow as app/admin/page.js; see its comment
  // for why a pendingToken (not a real session) is what comes back first
  // for an account with 2FA on.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [showMyAccount, setShowMyAccount] = useState(false);

  // Phase 5b: cookie-only, same as the main admin gates (app/admin/page.js,
  // app/admin/dashboard/page.js) — no sessionStorage anymore, /api/admin/me
  // (reading the httpOnly cookie) is the only source of truth. A kitchen
  // tablet is exactly the case this matters for: signed in once, then left
  // open or reopened later with no client-side state left at all except
  // the cookie itself.
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch('/api/admin/me');
        // res.json() resolves to `unknown` under real fetch typings — cast
        // to the small shape this endpoint actually returns.
        const data = (await res.json().catch(() => ({ authenticated: false }))) as { authenticated?: boolean };
        if (cancelled) return;
        setToken(data.authenticated ? 'cookie-session' : null);
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkSession();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      // Cast only (no .catch() added) — a JSON-parse failure here must
      // still throw and fall into the outer try/catch below, same as before.
      const data = (await res.json()) as { error?: string; twoFactorRequired?: boolean; pendingToken?: string };
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      if (data.twoFactorRequired) {
        setPendingToken(data.pendingToken || null);
        return;
      }
      // Phase 5b: no token in the response to store — the httpOnly cookie
      // the response just set is the whole session. `token` here is just
      // the same "are we authenticated" flag used elsewhere on this page.
      setToken('cookie-session');
    } catch {
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
      setToken('cookie-session');
    } catch {
      setError('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    fetch('/api/admin/logout', { method: 'POST' }).finally(() => {
      setToken(null);
    });
  };

  if (checking) return null;

  // Not logged in — this tablet/device hasn't signed in yet. Same
  // credentials as the main admin panel, just a simpler, bigger form
  // meant to be filled in once and then left alone.
  if (!token) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 420, padding: 32, background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 16 }}>
          <h1 style={{ marginBottom: 8, color: 'var(--cream)' }}>Kitchen Display</h1>
          <p style={{ marginBottom: 24, color: 'var(--muted)' }}>
            {pendingToken ? 'Enter the 6-digit code from your authenticator app.' : 'Sign in once on this device.'}
          </p>

          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#3A1712', color: '#FF8A75' }}>
              {error}
            </div>
          )}

          {pendingToken ? (
            <form onSubmit={handleVerify2fa}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: 'var(--cream)' }}>Verification code</label>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                  value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456" required
                  style={{ width: '100%', padding: 14, marginTop: 6, boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--cream)', fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
                />
              </div>
              <button
                type="submit" disabled={loading || code.length !== 6}
                style={{ width: '100%', padding: 16, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 8, background: 'var(--ember)', color: '#1A0D06', fontSize: 17, fontWeight: 700 }}
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button" onClick={() => { setPendingToken(null); setCode(''); setError(''); }}
                style={{ width: '100%', marginTop: 10, padding: 10, cursor: 'pointer', border: 'none', background: 'none', color: 'var(--muted)', fontSize: 13 }}
              >
                ← Back to login
              </button>
            </form>
          ) : (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'var(--cream)' }}>Email</label>
              <input
                type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required
                style={{ width: '100%', padding: 14, marginTop: 6, boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--cream)', fontSize: 16 }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: 'var(--cream)' }}>Password</label>
              <input
                type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required
                style={{ width: '100%', padding: 14, marginTop: 6, boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--cream)', fontSize: 16 }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: 16, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 8, background: 'var(--ember)', color: '#1A0D06', fontSize: 17, fontWeight: 700 }}
            >
              {loading ? 'Signing in…' : 'Open Kitchen Display'}
            </button>
          </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 22, color: 'var(--cream)' }}>
          ozy<span style={{ color: 'var(--ember)' }}>.fi</span> <span style={{ color: 'var(--muted)', fontFamily: 'inherit', fontSize: 16 }}>Kitchen</span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" onClick={() => setShowMyAccount(true)}
            style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
          >
            My Account
          </button>
          <button
            type="button" onClick={logout}
            style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>

      {showMyAccount && <MyAccountModal onClose={() => setShowMyAccount(false)} />}

      <OrderKanban token={token} size="large" />
    </main>
  );
}
