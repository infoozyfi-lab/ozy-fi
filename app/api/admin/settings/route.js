import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, purgeMenuCache } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const rows = await env.DB.prepare('SELECT key, value FROM admin_settings').all();

  const out = {};
  for (const r of rows.results) out[r.key] = r.value;

  delete out.admin_password;

  return json(out);
}

export async function PUT(request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  delete body.admin_password;
  delete body.ADMIN_PASSWORD;
  delete body.ADMIN_EMAIL;

  const stmts = Object.entries(body).map(([key, value]) =>
    env.DB.prepare(
      `INSERT INTO admin_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, value)
  );

  if (stmts.length) {
    await env.DB.batch(stmts);
  }

  await purgeMenuCache(request, ctx);

  return json({ ok: true });
}
