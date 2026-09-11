'use client';

import { useEffect, useState, type FormEvent, type MouseEvent, type ChangeEvent } from 'react';

interface TwoFaStatus {
  enabled: boolean;
  supported: boolean;
}

interface TwoFaSetupData {
  secret: string;
  otpauthUri: string;
}

// Self-service two-factor authentication (Phase 7.9) — shared by both
// app/admin/dashboard/page.js (all roles, since Staff Management is
// Owner-only and only covers OTHER accounts) and app/admin/kitchen/page.js
// (which had no account-settings surface at all before this). Every role
// can open this for their own account regardless of ROLE_TABS.
//
// Three states: loading the current on/off status, "off" (offer to set
// up), and "setting up" (show the secret + otpauth URI, ask for one code
// to confirm before it actually turns on). Deliberately shows the raw
// base32 secret as text rather than a QR code — see this feature's
// summary for why (no QR-encoding library available to verify end-to-end
// in this sandbox); most authenticator apps also accept pasting the full
// otpauth:// URI, so both are shown.
export default function MyAccountModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<TwoFaStatus | null>(null); // { enabled, supported } | null while loading
  const [statusError, setStatusError] = useState('');

  const [setupData, setSetupData] = useState<TwoFaSetupData | null>(null); // { secret, otpauthUri } | null
  const [confirmCode, setConfirmCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = () => {
    setStatusError('');
    fetch('/api/admin/2fa/status')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      // data is `unknown` (real fetch typings) — setStatus(data) is a direct
      // call, so (unlike a bare `.then(setStatus)` reference) it needs its
      // own cast rather than relying on .then()'s own lenient callback typing.
      .then((data) => setStatus(data as TwoFaStatus | null))
      .catch(() => setStatusError('Could not load your account status.'));
  };

  useEffect(loadStatus, []);

  const startSetup = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/2fa/setup', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string; secret?: string; otpauthUri?: string };
      if (!res.ok) throw new Error(data.error || 'Could not start setup.');
      setSetupData(data as TwoFaSetupData);
    } catch (err: any) {
      setError(err.message || 'Could not start setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Incorrect code.');
      setSetupData(null);
      setConfirmCode('');
      setMessage('Two-factor authentication is now on for your account.');
      loadStatus();
    } catch (err: any) {
      setError(err.message || 'Incorrect code.');
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    if (!window.confirm('Turn off two-factor authentication for your account?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/2fa/disable', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not turn off 2FA.');
      setMessage('Two-factor authentication is now off for your account.');
      loadStatus();
    } catch (err: any) {
      setError(err.message || 'Could not turn off 2FA.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card, #fff)', border: '1px solid var(--line, #ddd)', borderRadius: 16, padding: 24, color: 'var(--cream, #111)' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>My Account</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
        <p style={{ color: 'var(--muted, #888)', fontSize: 13.5, marginTop: 4 }}>
          Two-factor authentication (2FA)
        </p>

        {statusError && <p style={{ color: '#FF8A75' }}>{statusError}</p>}
        {error && <p style={{ color: '#FF8A75' }}>{error}</p>}
        {message && <p style={{ color: '#4ADE80' }}>{message}</p>}

        {!status ? (
          !statusError && <p>Loading…</p>
        ) : !status.supported ? (
          <p style={{ fontSize: 13.5 }}>
            2FA isn't available for the shared admin login — it only applies to individual staff accounts.
          </p>
        ) : setupData ? (
          <form onSubmit={confirmSetup}>
            <p style={{ fontSize: 13.5 }}>
              Scan or paste this into your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows to turn 2FA on.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, color: 'var(--muted, #888)' }}>Manual entry key</label>
              <div style={{ padding: 10, marginTop: 4, borderRadius: 8, background: 'var(--bg-alt, #f5f5f5)', fontFamily: 'monospace', fontSize: 15, letterSpacing: 1, wordBreak: 'break-all' }}>
                {setupData.secret}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12.5, color: 'var(--muted, #888)' }}>otpauth:// link (some apps accept pasting this)</label>
              <div style={{ padding: 10, marginTop: 4, borderRadius: 8, background: 'var(--bg-alt, #f5f5f5)', fontFamily: 'monospace', fontSize: 11.5, wordBreak: 'break-all' }}>
                {setupData.otpauthUri}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Enter the 6-digit code to confirm</label>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                value={confirmCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" required
                style={{ width: '100%', padding: 12, marginTop: 6, boxSizing: 'border-box', border: '1px solid var(--line, #ccc)', borderRadius: 8, fontSize: 18, letterSpacing: 3, textAlign: 'center' }}
              />
            </div>
            <button type="submit" disabled={busy || confirmCode.length !== 6} style={{ width: '100%', padding: 12, cursor: 'pointer', border: 'none', borderRadius: 8, background: '#111', color: '#fff', fontSize: 15 }}>
              {busy ? 'Confirming…' : 'Turn on 2FA'}
            </button>
            <button type="button" onClick={() => { setSetupData(null); setConfirmCode(''); setError(''); }} style={{ width: '100%', marginTop: 8, padding: 10, cursor: 'pointer', border: 'none', background: 'none', color: 'var(--muted, #888)', fontSize: 13 }}>
              Cancel
            </button>
          </form>
        ) : status.enabled ? (
          <div>
            <p style={{ fontSize: 13.5 }}>🔒 Two-factor authentication is <strong>on</strong> for your account.</p>
            <button type="button" disabled={busy} onClick={disable2fa} style={{ padding: '10px 16px', cursor: 'pointer', border: '1px solid #FF8A75', borderRadius: 8, background: 'none', color: '#FF8A75', fontSize: 14 }}>
              {busy ? 'Working…' : 'Turn off 2FA'}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13.5 }}>
              Add an extra step to your login using an authenticator app (Google Authenticator, Authy, or similar) — optional, off by default.
            </p>
            <button type="button" disabled={busy} onClick={startSetup} style={{ padding: '10px 16px', cursor: 'pointer', border: 'none', borderRadius: 8, background: '#111', color: '#fff', fontSize: 14 }}>
              {busy ? 'Starting…' : 'Set up 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
