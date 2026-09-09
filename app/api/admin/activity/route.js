import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Owner-only — the Activity Log is a record of what every staff member
// did, which is itself sensitive (order details, who's been changing
// prices, etc.) beyond just "Settings-adjacent".
export async function GET(request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['owner']);
  if (denied) return denied;

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;

  const rows = await env.DB.prepare(
    `SELECT id, staff_id, staff_name, action, detail, created_at
     FROM audit_log
     ORDER BY created_at DESC, id DESC
     LIMIT ?`
  ).bind(limit).all();

  return json(rows.results);
}
