import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { validateCoupon } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

// Public, unauthenticated — a coupon CODE isn't a secret (it's meant to
// be typed in by a customer, often printed/shared publicly), so this is
// safe to expose the same way the menu itself is. Only ever a preview:
// app/api/orders/route.js re-validates from scratch against its own
// server-computed subtotal before an order is ever created — this route
// never touches the orders table or times_used.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const body = (await request.json().catch(() => ({}))) as { subtotal?: unknown; code?: unknown };

  const subtotal = Number(body.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return json({ valid: false, error: 'Invalid order subtotal.' }, 400);
  }

  const result = await validateCoupon(env, body.code, subtotal);
  if (!result.valid || !result.coupon) return json(result, 200);

  return json({
    valid: true,
    code: result.coupon.code,
    discountType: result.coupon.discount_type,
    discountValue: result.coupon.discount_value,
    discountAmount: result.discountAmount,
    finalTotal: result.finalTotal,
  });
}
