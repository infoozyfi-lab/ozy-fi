import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import {
  createStaffToken,
  createLegacyOwnerToken,
  createPending2faToken,
  verifyPassword,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
} from '@/lib/adminAuth';

const TOKEN_LIFETIME_SECONDS = 86400; // 24h — must match adminAuth.js's own check

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function POST(request) {
  const { env } = await getCloudflareContext({ async: true });

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  // Opportunistic cleanup — keeps the table small without a separate
  // scheduled job. Cheap: one indexed delete per login attempt.
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 day')").run();

  const recentAttempts = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM login_attempts WHERE ip = ? AND attempted_at >= datetime('now', ?)`
  ).bind(ip, `-${WINDOW_MINUTES} minutes`).first();

  if (recentAttempts && recentAttempts.count >= MAX_ATTEMPTS) {
    return json({ error: `Too many failed attempts. Please try again in ${WINDOW_MINUTES} minutes.` }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (!env.SESSION_SECRET) {
    // Signing key for every session token — see lib/adminAuth.js's note
    // on why this is separate from any individual staff member's
    // password. Nothing below can safely proceed without it.
    return json({ error: 'Admin authentication is not configured (missing SESSION_SECRET)' }, 500);
  }

  const fail = async () => {
    await env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
    return json({ error: 'Invalid email or password' }, 401);
  };

  if (!email || !password) return fail();

  // Staff accounts first. Wrapped in try/catch: on a deploy where the
  // `staff` table migration hasn't been run yet, this query throws
  // (no such table) — that's expected during the rollout window, not an
  // error to surface to the person logging in, so we just fall through
  // to the legacy path below exactly as if no staff row matched.
  let staff = null;
  try {
    staff = await env.DB.prepare(
      'SELECT id, name, email, password_hash, role, active, totp_enabled FROM staff WHERE email = ?'
    ).bind(email).first();
  } catch {
    // On a deploy where migration 005 (staff 2FA columns) hasn't run yet,
    // selecting totp_enabled throws ("no such column") exactly like the
    // outer try/catch already handles a missing `staff` table entirely —
    // fall back to a query without it so login still works pre-migration,
    // just without 2FA support until the column exists.
    try {
      staff = await env.DB.prepare(
        'SELECT id, name, email, password_hash, role, active FROM staff WHERE email = ?'
      ).bind(email).first();
    } catch {
      staff = null;
    }
  }

  if (staff) {
    if (!staff.active) return fail();
    const valid = await verifyPassword(password, staff.password_hash);
    if (!valid) return fail();

    // Phase 7.9: password alone isn't enough for an account that's turned
    // on 2FA — hand back a short-lived pending token instead of a real
    // session. No cookie is set here; the browser must call
    // /api/admin/login/verify-2fa with this token + a correct TOTP code
    // before it gets one. See lib/adminAuth.js's createPending2faToken.
    if (staff.totp_enabled) {
      const pendingToken = await createPending2faToken(env, staff.id);
      return json({ twoFactorRequired: true, pendingToken });
    }

    const token = await createStaffToken(env, { id: staff.id, role: staff.role, name: staff.name });
    const response = NextResponse.json({ email: staff.email, name: staff.name, role: staff.role });
    response.cookies.set(ADMIN_COOKIE_NAME, token, { ...ADMIN_COOKIE_OPTIONS, maxAge: TOKEN_LIFETIME_SECONDS });
    return response;
  }

  // Legacy fallback — the single shared ADMIN_EMAIL/ADMIN_PASSWORD
  // Cloudflare Secret pair this project used before staff accounts
  // existed. Deliberately NOT removed yet: see this feature's summary
  // for the migration plan (seed an `owner` staff row for this same
  // email, confirm it works, then this whole branch can be deleted).
  // Until that's done and confirmed, this stays the only way to log in
  // on a database that hasn't been migrated at all yet.
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD && email === env.ADMIN_EMAIL && password === env.ADMIN_PASSWORD) {
    const token = await createLegacyOwnerToken(env, 'Owner');
    const response = NextResponse.json({ email: env.ADMIN_EMAIL, name: 'Owner', role: 'owner' });
    response.cookies.set(ADMIN_COOKIE_NAME, token, { ...ADMIN_COOKIE_OPTIONS, maxAge: TOKEN_LIFETIME_SECONDS });
    return response;
  }

  return fail();
}
