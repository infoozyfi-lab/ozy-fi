import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, phoneMatches } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });

  const url = new URL(request.url);
  const phone = url.searchParams.get('phone') || '';

  const order = await env.DB.prepare('SELECT * FROM orders WHERE order_num = ?')
    .bind(params.orderNum)
    .first();

  if (!order || !phoneMatches(order.phone, phone)) {
    return json({ error: 'Order not found' }, 404);
  }

  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?')
    .bind(order.id)
    .all();

  return json({ ...order, items: items.results });
}
