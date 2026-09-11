import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import type { OrderRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const url = new URL(request.url);
  const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');

  if (phone.length < 6) {
    return json({ error: 'Enter a valid phone number.' }, 400);
  }

  // Compare on the last 6 digits (same tolerance as the order-number+phone
  // lookup) — D1 has no easy "digits only" index, so this pulls a small
  // recent window and filters in code rather than a slow full-table scan.
  const rows = await env.DB.prepare(
    `SELECT order_num, phone, status, total, created_at FROM orders
     WHERE created_at >= datetime('now', '-7 days')
     ORDER BY created_at DESC
     LIMIT 200`
  ).all<Pick<OrderRow, 'order_num' | 'phone' | 'status' | 'total' | 'created_at'>>();

  const last6 = phone.slice(-6);
  const matches = rows.results
    .filter((o) => String(o.phone || '').replace(/\D/g, '').slice(-6) === last6)
    .slice(0, 5)
    .map((o) => ({
      orderNum: o.order_num,
      status: o.status,
      total: o.total,
      createdAt: o.created_at,
    }));

  return json({ orders: matches });
}
