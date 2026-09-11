import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, purgeMenuCache } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// admin_settings is one flat key/value table shared by three different
// UI sections (RestaurantInfoSettings, HomepageDisplaySettings,
// TrackingAnalyticsSettings — app/admin/dashboard/page.js) that per the
// staff-roles brief have DIFFERENT access: Manager gets Homepage Display
// only; Restaurant Settings and Tracking & Analytics (which holds ad-
// platform access tokens) are Owner-only. Since it's all one table
// behind one endpoint, that split has to happen here, by key — not just
// by hiding tabs in the UI, which a Manager could route around by
// calling this endpoint directly with a different body.
const HOMEPAGE_KEYS = new Set([
  'featured_type',
  'featured_product_id',
  'featured_bundle_id',
  'featured_banner_title',
  'featured_banner_price',
  'featured_banner_image',
  'popular_product_ids',
]);

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['manager', 'owner']);
  if (denied) return denied;

  // requireRole() just confirmed a valid session on this same request —
  // see app/api/admin/2fa/confirm/route.ts's identical comment.
  const session = (await getSession(request, env))!;

  // D1's .all() defaults its row type to Record<string, unknown> — narrowed
  // here to the actual admin_settings row shape so `r.key`/`r.value` are
  // usable as a Set key / index key below without further casts.
  const rows = await env.DB.prepare('SELECT key, value FROM admin_settings').all<{ key: string; value: unknown }>();

  const out: Record<string, unknown> = {};
  for (const r of rows.results) {
    if (session.role === 'manager' && !HOMEPAGE_KEYS.has(r.key)) continue;
    out[r.key] = r.value;
  }

  // Never expose admin password (defence in depth — nothing should ever
  // write a key literally named this, but cheap to guard anyway).
  delete out.admin_password;

  return json(out);
}

export async function PUT(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['manager', 'owner']);
  if (denied) return denied;

  // requireRole() just confirmed a valid session on this same request —
  // see app/api/admin/2fa/confirm/route.ts's identical comment.
  const session = (await getSession(request, env))!;
  // admin_settings is one flat key/value table — the body is an arbitrary
  // set of setting keys, not a fixed shape, so Record<string, unknown>
  // (rather than a named interface) is the accurate type here.
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Prevent changing authentication secrets through this endpoint,
  // regardless of role.
  delete body.admin_password;
  delete body.ADMIN_PASSWORD;
  delete body.ADMIN_EMAIL;

  const keys = Object.keys(body);

  if (session.role === 'manager') {
    const disallowed = keys.filter((k) => !HOMEPAGE_KEYS.has(k));
    if (disallowed.length) {
      // A real 403, not a silent drop — this is exactly what the "hit a
      // restricted API directly" verification step checks for. A
      // Manager only ever gets this by calling the API by hand (the
      // Homepage Display UI never sends anything outside HOMEPAGE_KEYS).
      return json(
        { error: `Your role can't change: ${disallowed.join(', ')}` },
        403
      );
    }
  }

  if (!keys.length) {
    return json({ ok: true }); // nothing left to write after stripping the auth keys above
  }

  const stmts = Object.entries(body).map(([key, value]) =>
    env.DB.prepare(
      `INSERT INTO admin_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, value)
  );

  await env.DB.batch(stmts);

  await purgeMenuCache(request, ctx);

  // Key names only, never values — some of these keys hold ad-platform
  // access tokens, and the Activity Log is meant to be readable by any
  // Owner, not a second place secrets could leak from.
  ctx.waitUntil(logActivity(env, session, 'settings.updated', `Updated: ${keys.join(', ')}`));

  return json({ ok: true });
}
