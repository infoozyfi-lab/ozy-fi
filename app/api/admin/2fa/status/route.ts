import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireAdmin, getSession } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Lets MyAccountModal (components/admin/MyAccountModal.js) find out
// whether 2FA is currently on for the SIGNED-IN staff member, without
// bloating /api/admin/me (which every page load hits and deliberately
// does zero DB work — see its own comment). This is only fetched when
// the modal actually opens.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  // requireAdmin() just confirmed a valid session on this same request —
  // see app/api/admin/2fa/confirm/route.ts's identical comment.
  const session = (await getSession(request, env))!;
  if (session.isLegacy) {
    return json({ enabled: false, supported: false });
  }

  const staff = await env.DB.prepare('SELECT totp_enabled FROM staff WHERE id = ?').bind(session.staffId).first();
  return json({ enabled: !!(staff && staff.totp_enabled), supported: true });
}
