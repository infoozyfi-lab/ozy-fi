import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import type { StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COUPON_ROLES: StaffRole[] = ['manager', 'owner'];
const DISCOUNT_TYPES = ['percent', 'amount'];

// Editing an existing coupon — active/value/type/expiry/limits. No
// separate DELETE route: "deactivate" (active = 0) is the intended way to
// retire a coupon per the brief, and it keeps times_used/history intact
// for whoever's looking at it later, instead of losing the record.
export async function PATCH(request: Request, { params }: { params: { code: string } }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, COUPON_ROLES);
  if (denied) return denied;

  const code = String(params.code || '').trim().toUpperCase();
  const existing = await env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first();
  if (!existing) return json({ error: 'Not found' }, 404);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const values: unknown[] = [];

  if ('active' in body) {
    sets.push('active = ?');
    values.push(body.active ? 1 : 0);
  }

  if ('discount_type' in body) {
    if (!DISCOUNT_TYPES.includes(body.discount_type as string)) {
      return json({ error: "discount_type must be 'percent' or 'amount'." }, 400);
    }
    sets.push('discount_type = ?');
    values.push(body.discount_type);
  }

  if ('discount_value' in body) {
    const v = Number(body.discount_value);
    if (!Number.isFinite(v) || v <= 0) return json({ error: 'discount_value must be a positive number.' }, 400);
    const type = body.discount_type || existing.discount_type;
    if (type === 'percent' && v > 100) return json({ error: 'A percent discount cannot be more than 100.' }, 400);
    sets.push('discount_value = ?');
    values.push(v);
  }

  if ('expires_at' in body) {
    if (body.expires_at) {
      // Date's constructor overloads don't accept `unknown` — cast to the
      // string/number shape the client is expected to send (validated by
      // the isNaN check right below, same as before this typing pass).
      const d = new Date(body.expires_at as string | number);
      if (Number.isNaN(d.getTime())) return json({ error: 'expires_at is not a valid date.' }, 400);
      sets.push('expires_at = ?');
      values.push(body.expires_at);
    } else {
      sets.push('expires_at = NULL');
    }
  }

  if ('min_order_amount' in body) {
    if (body.min_order_amount === null || body.min_order_amount === '') {
      sets.push('min_order_amount = NULL');
    } else {
      const v = Number(body.min_order_amount);
      if (!Number.isFinite(v) || v < 0) return json({ error: 'min_order_amount must be a non-negative number.' }, 400);
      sets.push('min_order_amount = ?');
      values.push(v);
    }
  }

  if ('usage_limit' in body) {
    if (body.usage_limit === null || body.usage_limit === '') {
      sets.push('usage_limit = NULL');
    } else {
      const v = Number(body.usage_limit);
      if (!Number.isInteger(v) || v < 1) return json({ error: 'usage_limit must be a whole number of at least 1.' }, 400);
      sets.push('usage_limit = ?');
      values.push(v);
    }
  }

  if (!sets.length) return json({ error: 'Nothing to update' }, 400);

  values.push(code);
  await env.DB.prepare(`UPDATE coupons SET ${sets.join(', ')} WHERE code = ?`).bind(...values).run();

  const session = await getSession(request, env);
  const changeDesc = Object.keys(body).join(', ');
  ctx.waitUntil(logActivity(env, session, 'coupon.updated', `Updated ${code} (${changeDesc})`));

  return json({ ok: true });
}
