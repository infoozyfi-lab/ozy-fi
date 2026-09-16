import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole, getSession, ROLES } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import type { StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

// True if `staffId` is the only remaining active Owner — used to block
// both "deactivate" and "demote to a different role" when it would leave
// the business with no way to reach Staff Management (or anything else
// Owner-only) at all. Excludes staffId itself from the count so this
// works whether or not its own role/active is being changed in the same
// request.
async function isLastActiveOwner(env: any, staffId: number): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM staff WHERE role = 'owner' AND active = 1 AND id != ?`
  ).bind(staffId).first();
  return Number(row?.count || 0) === 0;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['owner']);
  if (denied) return denied;

  const staffId = Number(params.id);
  if (!Number.isFinite(staffId)) return json({ error: 'Invalid staff id' }, 400);

  const target = await env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(staffId).first();
  if (!target) return json({ error: 'Not found' }, 404);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: { name?: string; role?: string; active?: number } = {};

  if ('name' in body) {
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Name cannot be empty.' }, 400);
    updates.name = name;
  }

  if ('role' in body) {
    // Same untrusted-input cast as app/api/admin/staff/route.ts's POST —
    // only used so ROLES.includes() (typed StaffRole[]) can check it.
    if (!ROLES.includes(body.role as StaffRole)) return json({ error: 'Invalid role.' }, 400);
    updates.role = body.role as string;
  }

  if ('active' in body) {
    updates.active = body.active ? 1 : 0;
  }

  // Phase 7.9 lockout recovery — not in the original brief, added as a
  // small, clearly-needed safety valve: without this, a staff member who
  // loses their authenticator device (phone lost/replaced/factory-reset)
  // has no way back into their own account, since only they could
  // previously turn 2FA off (POST /api/admin/2fa/disable, self-service
  // only). An Owner can force it off here instead. Handled as its own
  // UPDATE rather than folding into `updates` above, since it's an
  // action ("clear this account's 2FA") rather than a settable field —
  // it can be combined with a name/role/active change in the same
  // request, or sent completely on its own.
  const disable2fa = body.disable2fa === true;

  // Lockout guard: if this row is currently the last active Owner, block
  // anything that would remove that status — demoting its role away from
  // 'owner', or deactivating it — while it's the only one left.
  const losingOwnerStatus =
    target.role === 'owner' && target.active === 1 &&
    (('role' in updates && updates.role !== 'owner') || ('active' in updates && updates.active === 0));

  if (losingOwnerStatus && (await isLastActiveOwner(env, staffId))) {
    return json({ error: "Can't remove the last remaining Owner account — promote someone else to Owner first." }, 409);
  }

  if (!Object.keys(updates).length && !disable2fa) {
    return json({ error: 'Nothing to update' }, 400);
  }

  const session = await getSession(request, env);

  if (Object.keys(updates).length) {
    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    await env.DB.prepare(`UPDATE staff SET ${setClause} WHERE id = ?`).bind(...values, staffId).run();

    const changeDesc = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ');
    ctx.waitUntil(logActivity(env, session, 'staff.updated', `Updated ${target.name} (${changeDesc})`));
  }

  if (disable2fa) {
    // Harmless no-op if 2FA wasn't on for this account — still worth the
    // audit entry either way, since an Owner reaching for this button at
    // all is itself a signal worth a record (e.g. a device-loss incident).
    await env.DB.prepare('UPDATE staff SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').bind(staffId).run();
    ctx.waitUntil(logActivity(env, session, 'staff.2fa_disabled_by_owner', `Force-disabled 2FA on ${target.name}'s account`));
  }

  return json({ ok: true });
}
