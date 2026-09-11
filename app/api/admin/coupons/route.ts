import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import type { StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Coupons live under Menu & Pricing's access level per the brief for this
// feature ("matches Menu & Pricing's access level") — Kitchen never sees
// pricing, Manager/Owner both manage it.
const COUPON_ROLES: StaffRole[] = ['manager', 'owner'];

const DISCOUNT_TYPES = ['percent', 'amount'];

function normalizeCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, COUPON_ROLES);
  if (denied) return denied;

  const rows = await env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
  return json(rows.results);
}

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, COUPON_ROLES);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = normalizeCode(body.code);
  const discountType = String(body.discount_type || '');
  const discountValue = Number(body.discount_value);

  if (!code) return json({ error: 'Coupon code is required.' }, 400);
  if (!DISCOUNT_TYPES.includes(discountType)) {
    return json({ error: "discount_type must be 'percent' or 'amount'." }, 400);
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return json({ error: 'discount_value must be a positive number.' }, 400);
  }
  if (discountType === 'percent' && discountValue > 100) {
    return json({ error: 'A percent discount cannot be more than 100.' }, 400);
  }

  let minOrderAmount: number | null = null;
  if (body.min_order_amount !== undefined && body.min_order_amount !== null && body.min_order_amount !== '') {
    minOrderAmount = Number(body.min_order_amount);
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      return json({ error: 'min_order_amount must be a non-negative number.' }, 400);
    }
  }

  let usageLimit: number | null = null;
  if (body.usage_limit !== undefined && body.usage_limit !== null && body.usage_limit !== '') {
    usageLimit = Number(body.usage_limit);
    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
      return json({ error: 'usage_limit must be a whole number of at least 1.' }, 400);
    }
  }

  // expires_at: stored as-is (an ISO date/datetime string from the admin
  // form's <input type="date">) — validated only for "is this a date at
  // all", the exact time-of-day granularity doesn't matter for a coupon
  // expiry.
  let expiresAt: unknown = null;
  if (body.expires_at) {
    // Date's constructor overloads don't accept `unknown` — cast to the
    // string/number shape the client is expected to send (validated by
    // the isNaN check right below, same as before this typing pass).
    const d = new Date(body.expires_at as string | number);
    if (Number.isNaN(d.getTime())) return json({ error: 'expires_at is not a valid date.' }, 400);
    expiresAt = body.expires_at;
  }

  const existing = await env.DB.prepare('SELECT code FROM coupons WHERE code = ?').bind(code).first();
  if (existing) return json({ error: `Coupon code "${code}" already exists.` }, 409);

  await env.DB.prepare(
    `INSERT INTO coupons (code, discount_type, discount_value, active, expires_at, min_order_amount, usage_limit)
     VALUES (?, ?, ?, 1, ?, ?, ?)`
  ).bind(code, discountType, discountValue, expiresAt, minOrderAmount, usageLimit).run();

  const session = await getSession(request, env);
  const valueLabel = discountType === 'percent' ? `${discountValue}%` : `${discountValue}€`;
  ctx.waitUntil(logActivity(env, session, 'coupon.created', `Created ${code} (${valueLabel} off)`));

  return json({ ok: true, code }, 201);
}
