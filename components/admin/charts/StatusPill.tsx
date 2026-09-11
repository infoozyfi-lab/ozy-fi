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

export default function StatusPill({ status }: { status: OrderStatus }) {
  const color = ORDER_STATUS_COLOR[status] || 'var(--muted)';
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
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export { STATUS_LABELS };
