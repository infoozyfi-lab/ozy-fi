import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { createAdminToken, ADMIN_COOKIE_NAME, ADMIN_COOKIE_OPTIONS } from '@/lib/adminAuth';

// Token lifetime — kept in one place so the cookie's maxAge and the
// token's own timestamp check in isAdmin() (lib/adminAuth.js) can't drift.
const TOKEN_LIFETIME_SECONDS = 86400; // 24h

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

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return json({ error: 'Admin authentication is not configured' }, 500);
  }

  if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
    await env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
    return json({ error: 'Invalid email or password' }, 401);
  }

  const token = await createAdminToken(env);

  // The token is still returned in the JSON body (and the client still
  // mirrors it into sessionStorage) so none of the existing admin fetch()
  // calls that build `Authorization: Bearer <token>` by hand need to
  // change — this is the dual-support transition period. The httpOnly
  // cookie below is what actually keeps the admin signed in from now on.
  //
  // Deliberately using NextResponse.cookies here rather than next/headers'
  // cookies(). next/headers reads/writes through Next's per-request
  // AsyncLocalStorage context; on a previous attempt, using it inside this
  // Route Handler produced a cookie that silently never reached the
  // browser once deployed to Cloudflare via OpenNext (worked in
  // `next dev`, not on the Workers preview) — the mutation was being
  // recorded somewhere the OpenNext Cloudflare adapter's response
  // serialization for Route Handlers doesn't currently read from.
  // NextResponse.cookies.set() instead writes the Set-Cookie header
  // directly onto the exact Response object this function returns — no
  // separate context/merge step for anything to drop — so it doesn't
  // depend on that machinery at all.
  const response = NextResponse.json({ token, email: env.ADMIN_EMAIL });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: TOKEN_LIFETIME_SECONDS,
  });
  return response;
}
