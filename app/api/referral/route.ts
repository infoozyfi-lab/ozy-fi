import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, makeCouponCode } from '@/lib/api-helpers';
import type { CouponRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// "e.g. 3€ off" per the brief — a plain, explicit number rather than
// another admin-configurable setting, since the brief gave one for this
// feature specifically (unlike the welcome discount and stamp-card
// reward, which the brief left unspecified — see those features'
// settings keys). If the business owner wants this admin-configurable
// too, it's the same small addition as those two.
const REFERRAL_DISCOUNT_AMOUNT = 3;

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

  const code = makeCouponCode('FRIEND');
  await env.DB.prepare(
    `INSERT INTO coupons (code, discount_type, discount_value, active, usage_limit, referral_email)
     VALUES (?, 'amount', ?, 1, 1, ?)`
  ).bind(code, REFERRAL_DISCOUNT_AMOUNT, email).run();

  return json({ code, alreadyHad: false }, 201);
}
