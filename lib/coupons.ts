import type { CouponRow, CouponValidationResult } from '@/lib/types';

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
export async function validateCoupon(env: any, rawCode: unknown, subtotal: number): Promise<CouponValidationResult> {
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

  let discountAmount = coupon.discount_type === 'percent'
    ? subtotal * (coupon.discount_value / 100)
    : coupon.discount_value;

  // Never let a discount take the order below 0 (a flat-amount coupon
  // bigger than a small order, e.g. "5€ off" on a 3€ item).
  discountAmount = Math.min(discountAmount, subtotal);
  discountAmount = Math.round(discountAmount * 100) / 100;

  const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;

  return { valid: true, coupon, discountAmount, finalTotal };
}
