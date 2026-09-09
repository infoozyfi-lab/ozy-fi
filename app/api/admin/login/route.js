import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { createAdminToken } from '@/lib/adminAuth';

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

  // Sets the same token as an httpOnly cookie (can't be read by page
  // JavaScript, so an XSS bug elsewhere on the site can't exfiltrate it)
  // in addition to returning it in the response body. Existing admin
  // fetch calls that still attach it as an Authorization header keep
  // working unchanged during the transition — see lib/adminAuth.js's
  // extractToken(), which checks the cookie first, then falls back to
  // the header. Secure + SameSite=Strict since this is same-origin only.
  return new Response(JSON.stringify({ token, email: env.ADMIN_EMAIL }), {
    status: 200,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'set-cookie': `ozy_admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
    },
  });
}
