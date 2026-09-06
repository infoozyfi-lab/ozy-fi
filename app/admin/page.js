'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();

    alert('Login system will be connected next.');
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px',
          border: '1px solid #ddd',
          borderRadius: '16px',
        }}
      >
        <h1>OZY Admin</h1>

        <p>Sign in to manage your restaurant.</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="hello@ozy.fi"
              required
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter password"
              required
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '13px',
              cursor: 'pointer',
            }}
          >
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
