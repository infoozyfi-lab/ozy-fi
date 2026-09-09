'use client';

import { useEffect, useState } from 'react';
import OrderKanban from '@/components/admin/OrderKanban';

export default function KitchenPage() {
  const [token, setToken] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = sessionStorage.getItem('ozy_admin_token');
    setToken(t || null);
    setChecking(false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      sessionStorage.setItem('ozy_admin_token', data.token);
      sessionStorage.setItem('ozy_admin_email', data.email);
      setToken(data.token);
    } catch {
      setError('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('ozy_admin_token');
    sessionStorage.removeItem('ozy_admin_email');
    fetch('/api/admin/logout', { method: 'POST' }).finally(() => setToken(null));
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
          <p style={{ marginBottom: 24, color: 'var(--muted)' }}>Sign in once on this device.</p>

          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#3A1712', color: '#FF8A75' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'var(--cream)' }}>Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{ width: '100%', padding: 14, marginTop: 6, boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)', color: 'var(--cream)', fontSize: 16 }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: 'var(--cream)' }}>Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
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
        <button
          type="button" onClick={logout}
          style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>

      <OrderKanban token={token} size="large" />
    </main>
  );
}
