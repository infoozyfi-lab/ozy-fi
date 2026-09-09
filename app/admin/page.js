'use client';

import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // If a valid session already exists, skip the login form instead of
  // making it look like they got logged out. Two ways that can be true:
  // a sessionStorage token from this same tab (checked first — no network
  // round trip needed), or an httpOnly cookie from a previous visit that
  // outlived the tab that created it (a fresh tab has no sessionStorage,
  // so /api/admin/me is what can still tell us "yes, still signed in").
  //
  // This whole check is wrapped so `checking` is *guaranteed* to end up
  // false one way or another — a version of this that let a network
  // hiccup skip straight to `return` without that used to leave the page
  // stuck showing nothing (see /api/admin/me's comment for the story).
  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      const t = sessionStorage.getItem('ozy_admin_token');
      if (t) {
        window.location.href = '/admin/dashboard';
        return;
      }

      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json().catch(() => ({ authenticated: false }));
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

  const handleLogin = async (e) => {
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

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      sessionStorage.setItem('ozy_admin_token', data.token);
      sessionStorage.setItem('ozy_admin_email', data.email);

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
          Sign in to manage your restaurant.
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

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
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
      </div>
      )}
    </main>
  );
}
