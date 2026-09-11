import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireAdmin, getSession } from '@/lib/adminAuth';
import { generateTotpSecret, buildOtpAuthUri } from '@/lib/totp';
import type { StaffRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Step 1 of self-service 2FA setup (Phase 7.9) — any signed-in staff
// member sets this up for their OWN account only (there's no staffId in
// the request body; it always acts on the current session). Generates a
// new secret and stores it as "pending" (totp_secret set, totp_enabled
// still 0) — nothing actually changes about how this account logs in
// until POST /api/admin/2fa/confirm verifies a real code from it.
//
// Deliberately refuses to run again while 2FA is already enabled, rather
// than silently overwriting the secret an authenticator app already has
// — that would lock the account out of its OWN working 2FA the moment
// this call returns, before the replacement is ever confirmed. Disable
// first (POST /api/admin/2fa/disable), then set up again.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  // requireAdmin() just confirmed a valid session on this same request —
  // see app/api/admin/2fa/confirm/route.ts's identical comment.
  const session = (await getSession(request, env))!;
  if (session.isLegacy) {
    return json({ error: '2FA requires a real staff account — the shared admin login can\'t use it.' }, 400);
  }

  const staff = await env.DB.prepare('SELECT id, email, totp_enabled FROM staff WHERE id = ?').bind(session.staffId).first<StaffRow>();
  if (!staff) return json({ error: 'Staff account not found.' }, 404);
  if (staff.totp_enabled) {
    return json({ error: '2FA is already enabled on this account — disable it first to set up a new device.' }, 400);
  }

  const secret = generateTotpSecret();
  await env.DB.prepare('UPDATE staff SET totp_secret = ? WHERE id = ?').bind(secret, staff.id).run();

  const otpauthUri = buildOtpAuthUri(secret, staff.email);

  // No QR image rendered here — see this feature's summary for why (no
  // QR-encoding library available to verify end-to-end in this sandbox).
  // Both the raw secret (manual entry) and the full otpauth:// URI (some
  // authenticator apps accept pasting this directly) are returned so the
  // client can show whichever's more convenient.
  return json({ secret, otpauthUri });
}
