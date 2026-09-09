import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireAdmin, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import { verifyTotpCode } from '@/lib/totp';

export const dynamic = 'force-dynamic';

// Step 2 of self-service 2FA setup — proves the staff member actually
// scanned/entered the secret from /api/admin/2fa/setup correctly into
// their authenticator app before 2FA starts being required at login.
// Only this call ever flips totp_enabled to 1.
export async function POST(request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const session = await getSession(request, env);
  if (session.isLegacy) {
    return json({ error: '2FA requires a real staff account — the shared admin login can\'t use it.' }, 400);
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || '');

  const staff = await env.DB.prepare('SELECT id, name, totp_secret, totp_enabled FROM staff WHERE id = ?').bind(session.staffId).first();
  if (!staff) return json({ error: 'Staff account not found.' }, 404);
  if (staff.totp_enabled) return json({ error: '2FA is already enabled.' }, 400);
  if (!staff.totp_secret) return json({ error: 'Start setup first (POST /api/admin/2fa/setup).' }, 400);

  const valid = await verifyTotpCode(staff.totp_secret, code);
  if (!valid) return json({ error: 'Incorrect code — check the time on your device and try again.' }, 400);

  await env.DB.prepare('UPDATE staff SET totp_enabled = 1 WHERE id = ?').bind(staff.id).run();
  ctx.waitUntil(logActivity(env, session, 'staff.2fa_enabled', `${staff.name} turned on two-factor authentication`));

  return json({ ok: true });
}
