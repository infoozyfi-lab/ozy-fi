import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { getSession } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Lets a fresh tab (no sessionStorage, cookie-only session) find out
// whether it's actually signed in — and now also who's signed in and
// what role they have, so the dashboard can filter its own tabs
// (app/admin/dashboard/page.js's TOP_TABS) without a separate request.
// Deliberately always resolves with a 200 + JSON body — never a thrown
// error or a non-JSON response — because the client-side "am I logged
// in" gates await this and must never be left with a promise that
// neither resolves usefully nor rejects cleanly; that's exactly the
// shape of bug that produced the permanently-blank dashboard before
// (see the login route's comment for the full story).
export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const session = await getSession(request, env);

    if (!session) {
      return json({ authenticated: false });
    }

    return json({
      authenticated: true,
      staffId: session.staffId,
      name: session.name,
      role: session.role,
      isLegacy: session.isLegacy,
    });
  } catch (err) {
    console.error('GET /api/admin/me error:', err);
    return json({ authenticated: false });
  }
}
