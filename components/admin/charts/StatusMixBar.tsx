'use client';

import type { OrderStatus } from '@/lib/types';
import { ORDER_STATUS_COLOR } from './colors';

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing',
  on_the_way: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const ORDER: OrderStatus[] = ['received', 'preparing', 'on_the_way', 'delivered', 'cancelled'];

// Part-to-whole order-status mix: one 100%-stacked bar (status = state, so
// it wears the fixed status/semantic colors, never the categorical set),
// with a 2px surface gap between segments and a label+count legend below —
// color never carries the meaning alone.
export default function StatusMixBar({ counts }: { counts: Partial<Record<OrderStatus, number>> }) {
  const total = ORDER.reduce((s, k) => s + (counts[k] || 0), 0);

  if (total === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '8px 0' }}>No orders in the last 30 days.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-alt)' }}>
        {ORDER.map((key) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              title={`${STATUS_LABELS[key]}: ${count}`}
              style={{
                width: `${pct}%`,
                background: ORDER_STATUS_COLOR[key],
                marginRight: 2,
                minWidth: pct > 0 ? 3 : 0,
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: 14 }}>
        {ORDER.map((key) => {
          const count = counts[key] || 0;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: ORDER_STATUS_COLOR[key], flexShrink: 0 }} />
              <span style={{ color: 'var(--cream)', fontWeight: 600 }}>{count}</span>
              <span style={{ color: 'var(--muted)' }}>{STATUS_LABELS[key]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
