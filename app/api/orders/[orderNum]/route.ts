import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, phoneMatches } from '@/lib/api-helpers';
import type { OrderRow, OrderItemRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { orderNum: string } }) {
  const { env } = await getCloudflareContext({ async: true });

  const url = new URL(request.url);
  const phone = url.searchParams.get('phone') || '';

  const order = await env.DB.prepare('SELECT * FROM orders WHERE order_num = ?')
    .bind(params.orderNum)
    .first<OrderRow>();

  // Order number alone isn't secret enough to hand back a stranger's name,
  // address and phone on request — also require the phone number used at
  // checkout. Same generic error either way, so a guesser can't tell which
  // part was wrong.
  if (!order || !phoneMatches(order.phone, phone)) {
    return json({ error: 'Order not found' }, 404);
  }

  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?')
    .bind(order.id)
    .all<OrderItemRow>();

  return json({ ...order, items: items.results });
}
