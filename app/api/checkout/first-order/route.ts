import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, findOrdersByPhone } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Feature 2 — first-order welcome discount. CheckoutModal.tsx calls this
// once the customer has typed a plausibly-complete phone number, purely
// to show (or not show) the "First order? Enjoy X% off!" banner — this
// is advisory only, exactly like /api/coupons/validate's preview. The
// REAL check happens again from scratch in POST /api/orders at order-
// creation time (never trusting anything the client claims here), same
// "never trust the client" principle applied everywhere else in this
// codebase. No auth needed: this reveals nothing about anyone's order
// history beyond a plain yes/no for the phone number given, same
// disclosure level as GET /api/orders/by-phone.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const url = new URL(request.url);
  const phone = url.searchParams.get('phone') || '';

  if (phone.replace(/\D/g, '').length < 6) {
    return json({ eligible: false });
  }

  const prior = await findOrdersByPhone(env, phone);
  return json({ eligible: prior.length === 0 });
}
