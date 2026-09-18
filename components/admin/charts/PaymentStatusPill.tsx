'use client';

import { PAYMENT_STATUS_COLOR } from './colors';

type KnownPaymentStatus = keyof typeof PAYMENT_STATUS_COLOR; // 'cod' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'

const PAYMENT_STATUS_LABELS: Record<KnownPaymentStatus, string> = {
  cod: 'Cash on delivery',
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  // Part C (admin-initiated refunds) — set only by the Stripe webhook
  // (charge.refunded), never directly by the admin refund action itself.
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};

function isKnownPaymentStatus(s: string): s is KnownPaymentStatus {
  return s === 'cod' || s === 'pending' || s === 'paid' || s === 'failed' || s === 'refunded' || s === 'partially_refunded';
}

// `order.payment_status` (lib/types.ts) is typed as an optional plain
// `string`, not narrowed to a literal union, because a handful of call
// sites project only a subset of `orders` columns rather than SELECT *.
// The DB column itself is `TEXT NOT NULL DEFAULT 'cod'` with no CHECK
// constraint (worker/schema.sql), so this component stays defensive
// instead of assuming one of the four known values ever written by the
// app: undefined/null/anything unrecognized falls back to the 'cod'
// treatment, which is what every pre-Stripe/legacy order actually is.
export default function PaymentStatusPill({ status }: { status?: string | null }) {
  const resolved: KnownPaymentStatus = status && isKnownPaymentStatus(status) ? status : 'cod';
  const color = PAYMENT_STATUS_COLOR[resolved];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: `${color}1F`,
        border: `1px solid ${color}4D`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {PAYMENT_STATUS_LABELS[resolved]}
    </span>
  );
}

export { PAYMENT_STATUS_LABELS };
