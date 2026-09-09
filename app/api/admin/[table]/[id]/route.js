import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// Same access as app/api/admin/[table]/route.js — see its comment.
const TABLE_ROLES = ['manager', 'owner'];

export async function PUT(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
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

  const session = await getSession(request, env);
  ctx.waitUntil(
    logActivity(env, session, `${params.table}.updated`, `Updated ${params.table} "${params.id}" (${cols.join(', ')})`)
  );

  return json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  await env.DB.prepare(`DELETE FROM ${params.table} WHERE id = ?`).bind(params.id).run();

  await purgeMenuCache(request, ctx);

  const session = await getSession(request, env);
  ctx.waitUntil(logActivity(env, session, `${params.table}.deleted`, `Deleted ${params.table} "${params.id}"`));

  return json({ ok: true });
}
