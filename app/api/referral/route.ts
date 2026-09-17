import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeCouponCode } from '@/lib/api-helpers';
import type { CouponRow, DiscountValue } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Rewards dashboard consolidation — was a plain hardcoded constant
// ("e.g. 3€ off" per the original brief); now admin-configurable
// (referral_discount_type/referral_discount_value — see app/admin/
// dashboard/page.tsx's RewardsTab, and worker/migrations/
// 011_shared_discount_value.sql for the shared discount-value shape
// this was folded into). Falls back to 3 (the old hardcoded value) when
// the VALUE is blank/unset, so existing behavior is unchanged for anyone
// who hasn't touched the new setting — same "old value as the fallback
// default" approach used for stamp_card_every_n_orders. Deliberately NOT
// using lib/pricing.ts's readDiscountSetting here: that helper's "0,
// disabled" fallback would be wrong for this ONE feature, which has
// always defaulted to a real 3€ discount when unconfigured, never "no
// discount" — folding referral into the shared shape must not silently
// turn an unconfigured referral program off.
const DEFAULT_REFERRAL_DISCOUNT_AMOUNT = 3;

function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase();
}

// Feature 4 — referral program, Phase 1 (on-screen code only, no email
// sending — see this feature's brief). Public, unauthenticated by design
// (same as the Footer form that calls it): a visitor doesn't need an
// account to ask for a friend coupon. Flagged as a real gap in this
// delivery's summary: with no auth and no rate-limiting, nothing stops a
// script from calling this repeatedly with fake-but-valid-looking emails
// to mint many single-use coupons — acceptable for this project's
// current scale/threat model (same "acceptable at this business's
// volume" tradeoff already made elsewhere, e.g. the coupon-usage race in
// app/api/orders/route.ts), but worth revisiting before this gets
// meaningfully more traffic.
//
// Rewards dashboard consolidation — honest finding: this route only ever
// mints ONE coupon, for the person who submits their email (the "friend"
// side). There is no separate reward for the referrer (the customer who
// shared the form) anywhere in this codebase — Footer.tsx's own header
// comment already says "Phase 1: on-screen code only." So there's no
// second constant/amount to make separately configurable here; only
// referral_discount_type/referral_discount_value (below) exist. If a referrer-side reward is
// wanted, that would be new functionality (a "Phase 2"), not a
// relocation — out of scope for this consolidation task.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = normalizeEmail(body.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  const existing = await env.DB.prepare('SELECT code FROM coupons WHERE referral_email = ?')
    .bind(email)
    .first<Pick<CouponRow, 'code'>>();

  if (existing) {
    return json({ code: existing.code, alreadyHad: true });
  }

  const settingRows = await env.DB.prepare(
    "SELECT key, value FROM admin_settings WHERE key IN ('referral_discount_type', 'referral_discount_value')"
  ).all<{ key: string; value: string }>();
  const settingsByKey: Record<string, string> = {};
  for (const r of settingRows.results) settingsByKey[r.key] = r.value;

  // Deliberately NOT `Number(x) || DEFAULT` here (unlike stamp_card_every_
  // n_orders, where 0 is meaningless and should fall back either way) —
  // 0 is a valid amount an admin could genuinely choose for this field
  // (a token/free coupon), so only a missing/blank/non-numeric stored
  // value falls back to the old hardcoded default; an explicit "0" is
  // honored as 0. Type defaults to 'amount' — referral has always been
  // flat-euro-only, so an admin who hasn't touched the new type toggle
  // (or is on data from before this migration) keeps that exact behavior;
  // choosing 'percent' is new, opt-in capability.
  const rawValue = settingsByKey.referral_discount_value;
  const parsedValue = rawValue !== undefined && rawValue !== null && rawValue !== '' ? Number(rawValue) : NaN;
  const discount: DiscountValue = {
    type: settingsByKey.referral_discount_type === 'percent' ? 'percent' : 'amount',
    value: Number.isFinite(parsedValue) ? parsedValue : DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
  };

  const code = makeCouponCode('FRIEND');
  await env.DB.prepare(
    `INSERT INTO coupons (code, discount_type, discount_value, active, usage_limit, referral_email)
     VALUES (?, ?, ?, 1, 1, ?)`
  ).bind(code, discount.type, discount.value, email).run();

  return json({ code, alreadyHad: false }, 201);
}
