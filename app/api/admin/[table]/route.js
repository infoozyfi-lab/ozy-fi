import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, slugify, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// Menu & Pricing (categories/products/option_groups/options/addons/
// bundles, per ADMIN_TABLES) — Kitchen has no reason to read or write
// any of this; Manager and Owner both manage the menu.
const TABLE_ROLES = ['manager', 'owner'];

export async function GET(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
  if (denied) return denied;

  const table = ADMIN_TABLES[params.table];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const rows = await env.DB.prepare(`SELECT * FROM ${params.table} ORDER BY sort_order`).all();
  return json(rows.results);
}

export async function POST(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
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

  const session = await getSession(request, env);
  const label = body.name || body.label || body.id;
  ctx.waitUntil(logActivity(env, session, `${params.table}.created`, `Created ${params.table} "${label}"`));

  return json({ ok: true, id: body.id }, 201);
}
