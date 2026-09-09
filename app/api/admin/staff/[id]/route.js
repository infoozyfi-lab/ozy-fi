import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession, ROLES } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// True if `staffId` is the only remaining active Owner — used to block
// both "deactivate" and "demote to a different role" when it would leave
// the business with no way to reach Staff Management (or anything else
// Owner-only) at all. Excludes staffId itself from the count so this
// works whether or not its own role/active is being changed in the same
// request.
async function isLastActiveOwner(env, staffId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM staff WHERE role = 'owner' AND active = 1 AND id != ?`
  ).bind(staffId).first();
  return Number(row?.count || 0) === 0;
}

export async function PATCH(request, { params }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['owner']);
  if (denied) return denied;

  const staffId = Number(params.id);
  if (!Number.isFinite(staffId)) return json({ error: 'Invalid staff id' }, 400);

  const target = await env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(staffId).first();
  if (!target) return json({ error: 'Not found' }, 404);

  const body = await request.json().catch(() => ({}));
  const updates = {};

  if ('name' in body) {
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Name cannot be empty.' }, 400);
    updates.name = name;
  }

  if ('role' in body) {
    if (!ROLES.includes(body.role)) return json({ error: 'Invalid role.' }, 400);
    updates.role = body.role;
  }

  if ('active' in body) {
    updates.active = body.active ? 1 : 0;
  }

  // Lockout guard: if this row is currently the last active Owner, block
  // anything that would remove that status — demoting its role away from
  // 'owner', or deactivating it — while it's the only one left.
  const losingOwnerStatus =
    target.role === 'owner' && target.active === 1 &&
    (('role' in updates && updates.role !== 'owner') || ('active' in updates && updates.active === 0));

  if (losingOwnerStatus && (await isLastActiveOwner(env, staffId))) {
    return json({ error: "Can't remove the last remaining Owner account — promote someone else to Owner first." }, 409);
  }

  if (!Object.keys(updates).length) {
    return json({ error: 'Nothing to update' }, 400);
  }

  const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  const values = Object.values(updates);

  await env.DB.prepare(`UPDATE staff SET ${setClause} WHERE id = ?`).bind(...values, staffId).run();

  const session = await getSession(request, env);
  const changeDesc = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ');
  ctx.waitUntil(logActivity(env, session, 'staff.updated', `Updated ${target.name} (${changeDesc})`));

  return json({ ok: true });
}
