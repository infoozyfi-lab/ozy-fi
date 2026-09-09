import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { isAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Lets a fresh tab (no sessionStorage, cookie-only session) find out
// whether it's actually signed in. Deliberately always resolves with a
// 200 + JSON body — never a thrown error or a non-JSON response — because
// the client-side "am I logged in" gates (app/admin/page.js,
// app/admin/dashboard/page.js) await this and must never be left with a
// promise that neither resolves usefully nor rejects cleanly; that's
// exactly the shape of bug that produced the permanently-blank dashboard
// before (see the login route's comment for the full story).
export async function GET(request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const authenticated = await isAdmin(request, env);
    return json({ authenticated, email: authenticated ? env.ADMIN_EMAIL : null });
  } catch (err) {
    console.error('GET /api/admin/me error:', err);
    return json({ authenticated: false });
  }
}
