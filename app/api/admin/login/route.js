import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { createAdminToken } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return json({ error: 'Admin authentication is not configured' }, 500);
  }

  if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
    return json({ error: 'Invalid email or password' }, 401);
  }

  const token = await createAdminToken(env);
  return json({ token, email: env.ADMIN_EMAIL });
}
