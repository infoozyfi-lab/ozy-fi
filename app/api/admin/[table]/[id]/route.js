import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const body = await request.json().catch(() => ({}));
  const cols = table.cols.filter((c) => c in body && c !== 'id');

  if (!cols.length) {
    return json({ error: 'Nothing to update' }, 400);
  }

  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => body[c]);

  await env.DB.prepare(
    `UPDATE ${params.table} SET ${setClause} WHERE id = ?`
  ).bind(...values, params.id).run();

  await purgeMenuCache(request, ctx);

  return json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  await env.DB.prepare(`DELETE FROM ${params.table} WHERE id = ?`).bind(params.id).run();

  await purgeMenuCache(request, ctx);

  return json({ ok: true });
}
