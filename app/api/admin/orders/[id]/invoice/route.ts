import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole } from '@/lib/adminAuth';
import type { OrderRow, OrderItemRow, StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Invoices are a financial/customer-facing document — same access level as
// the analytics route (app/api/admin/analytics/route.ts), narrower than the
// plain order-detail fetch (which 'kitchen' also has, for the legitimate
// reason that kitchen staff need to see what's in an order to make it).
// Read-only: this route only SELECTs, never writes — Part B of this
// feature is explicitly additive and never touches how orders are stored.
const INVOICE_ROLES: StaffRole[] = ['manager', 'owner'];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, INVOICE_ROLES);
  if (denied) return denied;

  const { id } = await params;

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  if (!order) return json({ error: 'Not found' }, 404);

  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').bind(id).all<OrderItemRow>();

  return json({ order, items: items.results });
}
