import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Orders board — every role needs this (it's Kitchen's entire job, and
// Manager/Owner both see it too).
export async function GET(request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['kitchen', 'manager', 'owner']);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const rows = status
    ? await env.DB.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').bind(status).all()
    : await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();

  return json(rows.results);
}
