import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import {
  createStaffToken,
  verifyPending2faToken,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
} from '@/lib/adminAuth';
import { verifyTotpCode } from '@/lib/totp';
import type { StaffRow } from '@/lib/types';

const TOKEN_LIFETIME_SECONDS = 86400; // 24h — must match adminAuth.js's own check

export const dynamic = 'force-dynamic';

// Step 2 of login for an account with 2FA enabled — see
// /api/admin/login/route.js, which issues the pendingToken this consumes
// instead of a session cookie whenever staff.totp_enabled is set.
//
// Reuses the exact same IP-based login_attempts rate limiting as the main
// login route rather than building a separate mechanism — a 6-digit code
// is even more guessable than a password, so it needs at least the same
// protection, and there's no reason for this to be a weaker gate than the
// one it follows.
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 day')").run();

  const recentAttempts = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM login_attempts WHERE ip = ? AND attempted_at >= datetime('now', ?)`
  ).bind(ip, `-${WINDOW_MINUTES} minutes`).first<{ count: number }>();

  if (recentAttempts && recentAttempts.count >= MAX_ATTEMPTS) {
    return json({ error: `Too many failed attempts. Please try again in ${WINDOW_MINUTES} minutes.` }, 429);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const pendingToken = String(body.pendingToken || '');
  const code = String(body.code || '');

  const fail = async (message?: string) => {
    await env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
    return json({ error: message || 'Invalid or expired code.' }, 401);
  };

  if (!pendingToken || !code) return fail('A verification code is required.');

  const staffId = await verifyPending2faToken(env, pendingToken);
  if (staffId === null) {
    return fail('This login has expired — please sign in again.');
  }

  const staff = await env.DB.prepare(
    'SELECT id, name, email, role, active, totp_secret, totp_enabled FROM staff WHERE id = ?'
  ).bind(staffId).first<StaffRow>();

  // Re-check active + totp_enabled at verify time too, not just at the
  // first login step — an Owner could have deactivated this account or
  // force-disabled its 2FA in the few minutes between step 1 and step 2.
  if (!staff || !staff.active || !staff.totp_enabled || !staff.totp_secret) {
    return fail();
  }

  const valid = await verifyTotpCode(staff.totp_secret, code);
  if (!valid) return fail();

  const token = await createStaffToken(env, { id: staff.id, role: staff.role, name: staff.name });
  const response = NextResponse.json({ email: staff.email, name: staff.name, role: staff.role });
  response.cookies.set(ADMIN_COOKIE_NAME, token, { ...ADMIN_COOKIE_OPTIONS, maxAge: TOKEN_LIFETIME_SECONDS });
  return response;
}
