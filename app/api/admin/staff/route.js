import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession, hashPassword, ROLES } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// Owner-only, both directions — this is the one place that can create
// new logins and see who has one, so Manager/Kitchen never get near it.
export async function GET(request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['owner']);
  if (denied) return denied;

  // Never select password_hash (or totp_secret — same reasoning, a
  // shared secret that has no business leaving the database) — this
  // response goes straight to the Staff Management UI. totp_enabled is
  // just a boolean flag, safe to show so an Owner can see who has 2FA on
  // and use the force-disable action (PATCH .../staff/[id]) if needed.
  let rows;
  try {
    rows = await env.DB.prepare(
      'SELECT id, name, email, role, active, totp_enabled, created_at FROM staff ORDER BY created_at ASC'
    ).all();
  } catch {
    // Pre-migration-005 database (no totp_enabled column yet) — fall back
    // rather than 500ing the whole Staff tab over a column this feature
    // added.
    rows = await env.DB.prepare(
      'SELECT id, name, email, role, active, created_at FROM staff ORDER BY created_at ASC'
    ).all();
  }

  return json(rows.results);
}

export async function POST(request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['owner']);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = String(body.role || '');

  if (!name || !email || !password || !ROLES.includes(role)) {
    return json({ error: 'name, email, password and a valid role are required' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM staff WHERE email = ?').bind(email).first();
  if (existing) {
    return json({ error: 'A staff account with that email already exists.' }, 409);
  }

  const passwordHash = await hashPassword(password);

  const result = await env.DB.prepare(
    'INSERT INTO staff (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)'
  ).bind(name, email, passwordHash, role).run();

  const session = await getSession(request, env);
  ctx.waitUntil(logActivity(env, session, 'staff.created', `Added ${name} (${email}) as ${role}`));

  return json({ ok: true, id: result.meta.last_row_id }, 201);
}
