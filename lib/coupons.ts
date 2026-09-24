import type { CouponRow, CouponValidationResult } from '@/lib/types';
import { computeDiscountAmount } from '@/lib/pricing';

// Shared coupon validation + discount math — used by BOTH the public
// preview endpoint (app/api/coupons/validate/route.js, called from
// CheckoutModal for an instant "10% off applied" preview) and the actual
// order-creation route (app/api/orders/route.js, which is what actually
// counts). Sharing one function instead of writing the checks twice is
// deliberate: a preview that used slightly different logic than the real
// check would be worse than no preview at all — it could tell a customer
// their code works and then reject it at the final step, or vice versa.
//
// The preview result is still only ever advisory — app/api/orders/route.js
// calls this again itself, from the server-side subtotal it just
// recomputed from real product prices, never from anything the client
// sent. Same principle as this project's existing item-price
// re-validation there.

export function normalizeCouponCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

// subtotal: the pre-discount order total (already server-verified against
// real product prices by the caller, for the real /api/orders call — or a
// client-reported cart total for the advisory preview call, which is fine
// since nothing is committed at preview time).
// `env: any` used to make the D1 generic call below (`.first<T>()`) a real
// compile error — same TS2347 ("Untyped function calls may not accept type
// arguments") as lib/server-tracking.ts's loadTrackingSettings(). Typing
// `env` as the real bridged CloudflareEnv (global ambient, see
// cloudflare-env.d.ts) fixes it.
export async function validateCoupon(env: CloudflareEnv, rawCode: unknown, subtotal: number): Promise<CouponValidationResult> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { valid: false, error: 'Enter a coupon code.' };

  const coupon = await env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first<CouponRow>();
  if (!coupon) return { valid: false, error: 'This coupon code was not found.' };
  if (!coupon.active) return { valid: false, error: 'This coupon is no longer active.' };

  if (coupon.expires_at) {
    const expiry = new Date(coupon.expires_at);
    // Treat a date-only expiry (e.g. "2026-12-31" from an <input
    // type="date">) as valid through the END of that day, not midnight at
    // its start — otherwise a coupon "expiring" on the 31st would already
    // be rejected for orders placed on the 31st itself.
    if (!Number.isNaN(expiry.getTime())) {
      const endOfExpiryDay = coupon.expires_at.length <= 10
        ? new Date(expiry.getTime() + 24 * 60 * 60 * 1000 - 1)
        : expiry;
      if (Date.now() > endOfExpiryDay.getTime()) {
        return { valid: false, error: 'This coupon has expired.' };
      }
    }
  }

  if (coupon.usage_limit != null && coupon.times_used >= coupon.usage_limit) {
    return { valid: false, error: 'This coupon has reached its usage limit.' };
  }

  if (coupon.min_order_amount != null && subtotal < coupon.min_order_amount) {
    return {
      valid: false,
      error: `This coupon needs a minimum order of ${coupon.min_order_amount.toFixed(2)} €.`,
    };
  }

  // Shared discount-value pattern (see lib/types.ts's DiscountValue) —
  // this table's own discount_type/discount_value columns are exactly
  // that shape (they predate this task and are what it generalized), so
  // this is a pure refactor: same math as before (including the "never
  // let a discount take the order below 0" clamp for a flat-amount
  // coupon bigger than a small order), now shared with the other four
  // growth features via lib/pricing.ts's computeDiscountAmount rather
  // than duplicated here.
  let discountAmount = computeDiscountAmount(
    { type: coupon.discount_type, value: coupon.discount_value },
    subtotal
  );

  // Priority-fixes brief (roadmap gap analysis), Part 4 — an optional
  // per-coupon ceiling (worker/migrations/018_coupon_max_discount.sql).
  // Deliberately NOT folded into the shared computeDiscountAmount() in
  // lib/pricing.ts — that function is reused by scheduled offers,
  // referral, and the stamp card too, none of which have (or asked for)
  // a cap concept, so the clamp is applied locally here, only for
  // coupons. Clamping the already-computed amount (rather than passing
  // the cap into computeDiscountAmount) keeps this a pure "never exceed
  // X euros" ceiling regardless of whether the coupon is percent- or
  // amount-type — for an amount-type coupon this is a no-op in practice
  // (discount_value alone already IS the amount, and an admin would
  // have no reason to set a cap below it), but it stays meaningful if a
  // coupon is later switched from percent to amount without clearing
  // the cap.
  if (coupon.max_discount_amount != null && discountAmount > coupon.max_discount_amount) {
    discountAmount = coupon.max_discount_amount;
  }

  const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;

  return { valid: true, coupon, discountAmount, finalTotal };
}
