import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, phoneMatches } from '@/lib/api-helpers';
import type { OrderRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Checkout-improvements brief, item 12 — "save this address for next
// time". No new save step/opt-in exists (or is needed): every DELIVERY
// order already stores the customer's name and address for fulfillment,
// so a returning customer's most recent one is simply looked up by phone
// and used to prefill empty fields on their next visit — reusing data
// that's already there rather than inventing a new storage mechanism.
//
// Same phone-only trust model as the three other existing phone-matching
// lookups in this codebase (GET /api/checkout/first-order,
// GET /api/orders/by-phone, POST /api/orders/[orderNum]/reorder — all via
// lib/api-helpers.ts's phoneMatches/findOrdersByPhone) — this doesn't
// weaken or introduce anything beyond what customers can already do by
// phone alone elsewhere in this app. Advisory/convenience only: never
// used for anything beyond prefilling a form field the customer can
// freely edit or clear before placing their next order.
//
// Note: this table's `address` column only ever stores the street/
// house-number/city line (see app/api/orders/route.ts's storedAddress) —
// there is no postal_code column anywhere in the schema, so a postal
// code was never persisted for any past order and can't be returned
// here. The customer still re-enters that one field themselves.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const url = new URL(request.url);
  const phone = url.searchParams.get('phone') || '';

  if (phone.replace(/\D/g, '').length < 6) {
    return json({ found: false });
  }

  // Same "small recent window, filter in code" shape as GET /api/orders/
  // by-phone (no usable phone index in D1 to query against directly) —
  // widened to 90 days and 500 rows (vs. that route's 7 days/200) since a
  // customer's address genuinely doesn't go stale after a week the way
  // "orders I might want to track" does, and a delivery address is worth
  // finding even for a fairly occasional customer.
  const rows = await env.DB.prepare(
    `SELECT customer_name, address, phone, order_type, created_at FROM orders
     WHERE created_at >= datetime('now', '-90 days') AND (order_type IS NULL OR order_type = 'delivery')
     ORDER BY created_at DESC
     LIMIT 500`
  ).all<Pick<OrderRow, 'customer_name' | 'address' | 'phone' | 'order_type' | 'created_at'>>();

  // The SQL WHERE clause above already excludes pickup orders, but this
  // route's whole job is "never hand back the pickup sentinel string as
  // if it were a real delivery address" — re-checking here too (rather
  // than trusting the query alone) is cheap insurance against that,
  // matching this codebase's general "don't trust a single layer" habit.
  const match = rows.results.find((o) => o.order_type !== 'pickup' && phoneMatches(o.phone, phone));
  if (!match) {
    return json({ found: false });
  }

  return json({
    found: true,
    name: match.customer_name || '',
    address: match.address || '',
  });
}
