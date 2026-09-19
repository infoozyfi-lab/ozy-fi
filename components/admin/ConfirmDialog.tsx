'use client';

import type { MouseEvent } from 'react';

// Audit-fixes brief, Part 6.7 — every destructive admin action (cancel
// order, delete a menu resource, delete a scheduled offer/bundle, disable
// 2FA on your own or a staff member's account) used to gate itself behind
// a plain window.confirm(). That's a browser-native dialog the admin
// panel can't brand, can't restyle, and whose button order/wording
// varies by browser — and it blocks the whole tab's JS thread while open,
// which this codebase avoids everywhere else. This reuses the exact
// overlay/card visual language components/admin/OrderKanban.tsx's own
// EtaPromptModal/DriverPromptModal/RefundPromptModal already established
// for admin dialogs (fixed full-screen scrim, centered var(--bg-card)
// panel, click-outside-to-dismiss) rather than inventing a new look, so
// every admin confirmation now looks and behaves the same way.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Most of this component's callers are irreversible deletes/disables —
  // danger (red confirm button) is the default; pass false for a
  // confirmation that isn't destructive in that sense.
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(10,6,4,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={busy ? undefined : onCancel}
    >
      <div
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 380 }}
      >
        <h3 style={{ margin: '0 0 10px' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              background: 'none', border: '1px solid var(--line)', color: 'var(--cream)', borderRadius: 8,
              padding: '10px 16px', fontSize: 14, cursor: busy ? 'default' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              background: danger ? 'var(--danger)' : 'var(--ember)', color: 'var(--text-on-accent)', border: 'none',
              borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
