import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import type { StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Same access as app/api/admin/[table]/route.js — see its comment.
const TABLE_ROLES: StaffRole[] = ['manager', 'owner'];

export async function PUT(request: Request, { params }: { params: { table: string; id: string } }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const cols = table.cols.filter((c) => c in body && c !== 'id');

  if (!cols.length) {
    return json({ error: 'Nothing to update' }, 400);
  }

  // Products only: an offer price is meant to be a discount off the
  // regular price — never higher, since that would be confusing (or
  // worse, a discount that isn't one). Check against the FINAL values
  // (this update merged with whatever wasn't touched), not just what's
  // in this specific request, since a bulk price-only edit (see
  // components/admin/ResourceManager.js's bulk actions) can lower
  // `price` below an existing `offer_price` without ever touching
  // `offer_price` in the same request.
  if (params.table === 'products' && ('price' in body || 'offer_price' in body)) {
    const current = await env.DB.prepare('SELECT price, offer_price FROM products WHERE id = ?').bind(params.id).first<{ price: number; offer_price: unknown }>();
    const finalPrice = 'price' in body ? Number(body.price) : Number(current?.price);
    const finalOfferPrice = 'offer_price' in body ? body.offer_price : current?.offer_price;
    if (finalOfferPrice !== null && finalOfferPrice !== undefined && finalOfferPrice !== '' && Number(finalOfferPrice) > finalPrice) {
      return json({ error: 'Offer price cannot be higher than the regular price.' }, 400);
    }
  }

  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => body[c]);

  await env.DB.prepare(
    `UPDATE ${params.table} SET ${setClause} WHERE id = ?`
  ).bind(...values, params.id).run();

  await purgeMenuCache(request, ctx);

  const session = await getSession(request, env);
  ctx.waitUntil(
    logActivity(env, session, `${params.table}.updated`, `Updated ${params.table} "${params.id}" (${cols.join(', ')})`)
  );

  return json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { table: string; id: string } }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  await env.DB.prepare(`DELETE FROM ${params.table} WHERE id = ?`).bind(params.id).run();

  await purgeMenuCache(request, ctx);

  const session = await getSession(request, env);
  ctx.waitUntil(logActivity(env, session, `${params.table}.deleted`, `Deleted ${params.table} "${params.id}"`));

  return json({ ok: true });
}
