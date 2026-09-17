import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireAdmin, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// Self-service disable — any signed-in staff member can turn 2FA off for
// their OWN account (e.g. before switching to a new phone, or if they no
// longer want it). Gated only by the existing session, same as every
// other self-service action in this admin panel (there's no separate
// password re-confirmation step anywhere else here either — flagged in
// this feature's summary as a possible future hardening, not added here
// to keep this consistent with the rest of the panel).
//
// For the case where a staff member loses their authenticator device
// entirely and can't get back into their own account to call this, see
// the Owner-only force-disable on PATCH /api/admin/staff/[id].
export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  // requireAdmin() just confirmed a valid session on this same request —
  // see app/api/admin/2fa/confirm/route.ts's identical comment.
  const session = (await getSession(request, env))!;
  if (session.isLegacy) {
    return json({ error: 'The shared admin login has no 2FA to disable.' }, 400);
  }

  const staff = await env.DB.prepare('SELECT id, name FROM staff WHERE id = ?').bind(session.staffId).first();
  if (!staff) return json({ error: 'Staff account not found.' }, 404);

  await env.DB.prepare('UPDATE staff SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').bind(staff.id).run();
  ctx.waitUntil(logActivity(env, session, 'staff.2fa_disabled', `${staff.name} turned off two-factor authentication`));

  return json({ ok: true });
}
