import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, slugify, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const rows = await env.DB.prepare(`SELECT * FROM ${params.table} ORDER BY sort_order`).all();
  return json(rows.results);
}

export async function POST(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const body = await request.json().catch(() => ({}));

  if (!body.id && body.name) {
    body.id = `${slugify(body.name)}-${Date.now().toString(36).slice(-4)}`;
  }
  if (!body.id && body.label) {
    body.id = `${slugify(body.label)}-${Date.now().toString(36).slice(-4)}`;
  }
  if (!body.id) {
    return json({ error: 'id (or name/label) required' }, 400);
  }

  const cols = table.cols.filter((c) => c in body);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => body[c]);

  await env.DB.prepare(
    `INSERT INTO ${params.table} (${cols.join(', ')}) VALUES (${placeholders})`
  ).bind(...values).run();

  await purgeMenuCache(request, ctx);

  return json({ ok: true, id: body.id }, 201);
}
