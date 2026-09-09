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
  return json({ token, email: env.ADMIN_EMAIL });
}
