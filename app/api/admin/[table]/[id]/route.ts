import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import { validateScheduledOfferInput } from '@/lib/scheduledOffers';
import type { StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Same access as app/api/admin/[table]/route.js — see its comment. (Also
// see PUT below for 'staff's narrow, allow-listed exception to this.)
const TABLE_ROLES: StaffRole[] = ['manager', 'owner'];

export async function PUT(request: Request, { params }: { params: Promise<{ table: string; id: string }> }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const { table: tableName, id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 4 — the
  // one write a 'staff' session is allowed here: flipping a product's
  // `active` flag (its GET counterpart above explains why read access to
  // products/categories is separately allowed). This is an allow-list,
  // not a bypass of requireRole below — anything that doesn't match
  // (wrong table, or any body field besides `active`) falls through to
  // the exact same 403 every other non-Manager/Owner role already gets.
  const session = await getSession(request, env);
  if (session?.role === 'staff') {
    const bodyKeys = Object.keys(body).filter((k) => k !== 'id');
    const isAvailabilityToggle = tableName === 'products' && bodyKeys.length > 0 && bodyKeys.every((k) => k === 'active');
    if (!isAvailabilityToggle) {
      return json({ error: 'Forbidden — your role does not have access to this.' }, 403);
    }
  } else {
    const denied = await requireRole(request, env, TABLE_ROLES);
    if (denied) return denied;
  }

  const table = ADMIN_TABLES[tableName];
  if (!table) return json({ error: 'Unknown table' }, 404);

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
  if (tableName === 'products' && ('price' in body || 'offer_price' in body)) {
    const current = await env.DB.prepare('SELECT price, offer_price FROM products WHERE id = ?').bind(id).first<{ price: number; offer_price: unknown }>();
    const finalPrice = 'price' in body ? Number(body.price) : Number(current?.price);
    const finalOfferPrice = 'offer_price' in body ? body.offer_price : current?.offer_price;
    if (finalOfferPrice !== null && finalOfferPrice !== undefined && finalOfferPrice !== '' && Number(finalOfferPrice) > finalPrice) {
      return json({ error: 'Offer price cannot be higher than the regular price.' }, 400);
    }
  }

  // Growth features batch 2 (Feature 5) — same validation as the POST
  // route (app/api/admin/[table]/route.ts), applied to whichever fields
  // this particular update touches (a lone `active` toggle, for
  // instance, is valid on its own and shouldn't require re-sending
  // days/time/percent).
  if (tableName === 'scheduled_offers') {
    const validationError = validateScheduledOfferInput(body);
    if (validationError) return json({ error: validationError }, 400);
  }

  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => body[c]);

  // Save-failed bug report — same missing-try/catch gap as the sibling
  // POST route (app/api/admin/[table]/route.ts): an uncaught D1 error here
  // would propagate as a raw, non-JSON response, which is exactly what
  // components/admin/SizesEditor.tsx's saveTier() can't turn into a real
  // message (its `data.error || 'Save failed.'` fallback has no `.error`
  // to read from a response that isn't valid JSON at all). This specific
  // UPDATE didn't reproduce a real failure for a normal, correctly-scoped
  // edit (verified for real — see worker/test-data/save-failed-bug-verify.js),
  // but any admin-table write going through this shared route is one
  // unhandled D1 exception away from the same silent, undiagnosable
  // failure, so it gets the same defensive fix as its sibling.
  try {
    await env.DB.prepare(
      `UPDATE ${tableName} SET ${setClause} WHERE id = ?`
    ).bind(...values, id).run();
  } catch (err: any) {
    return json({ error: err?.message || `Could not update this ${tableName} row.` }, 500);
  }

  await purgeMenuCache(request, ctx);

  // `session` was already fetched above (needed there to decide staff's
  // narrower allow-list) — reused here rather than a second identical
  // getSession() call.
  ctx.waitUntil(
    logActivity(env, session, `${tableName}.updated`, `Updated ${tableName} "${id}" (${cols.join(', ')})`)
  );

  return json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ table: string; id: string }> }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
  if (denied) return denied;

  const { table: tableName, id } = await params;
  const table = ADMIN_TABLES[tableName];
  if (!table) return json({ error: 'Unknown table' }, 404);

  // Save-failed bug report — same defensive fix as PUT above (this file)
  // and POST (app/api/admin/[table]/route.ts): don't let an uncaught D1
  // error (e.g. a FOREIGN KEY reference from another row) turn into a
  // raw, non-JSON response the admin UI's `data.error` fallbacks can't
  // read anything from.
  try {
    await env.DB.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(id).run();
  } catch (err: any) {
    return json({ error: err?.message || `Could not delete this ${tableName} row.` }, 500);
  }

  await purgeMenuCache(request, ctx);

  const session = await getSession(request, env);
  ctx.waitUntil(logActivity(env, session, `${tableName}.deleted`, `Deleted ${tableName} "${id}"`));

  return json({ ok: true });
}
