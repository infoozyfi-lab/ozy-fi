import type { CSSProperties } from 'react';

// Shared inline-style constants for the generic resource CRUD UI —
// factored out of components/admin/ResourceManager.tsx so the extracted
// components/admin/ResourceForm.tsx (used both inline by ResourceManager
// and standalone by app/admin/products/[id]/edit/page.tsx) can use the
// exact same look without either duplicating these objects or importing
// them back out of ResourceManager.tsx (which would create a circular
// import, since ResourceManager now imports ResourceForm).

export const box: CSSProperties = {
  background: 'var(--bg-card)',
  padding: '24px',
  borderRadius: '12px',
  border: '1px solid var(--line)',
  marginBottom: '24px',
  color: 'var(--cream)',
};

export const th: CSSProperties = { textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--line)', fontSize: 13, color: 'var(--muted)' };
export const td: CSSProperties = { padding: '10px', borderBottom: '1px solid var(--line)', fontSize: 14, color: 'var(--cream)' };

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px',
  marginTop: '4px',
  boxSizing: 'border-box',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  fontSize: 14,
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
};

export const btn: CSSProperties = {
  padding: '8px 14px',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
  cursor: 'pointer',
  fontSize: 13,
  marginRight: 8,
};

export const btnPrimary: CSSProperties = { ...btn, background: 'var(--ember)', color: 'var(--text-on-accent)', border: 'none', fontWeight: 700 };
export const btnDanger: CSSProperties = { ...btn, color: 'var(--danger)', borderColor: 'var(--danger-border)' };
