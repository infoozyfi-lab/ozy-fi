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

// Menu & Pricing's "Pricing rules" box — Manager already fully manages
// the menu itself (app/api/admin/[table]/** allows manager+owner), so it
// should be able to set the one remaining rule that lives there too
// (this was a real, reported gap before this fix: Manager got a 403
// trying to save this box at all, since only HOMEPAGE_KEYS was ever
// allow-listed for that role).
const MENU_PRICING_KEYS = new Set([
  'size_large_upcharge',
]);

// Growth features batch 3 (Rewards dashboard consolidation) — every
// setting now managed from the dedicated "Rewards" admin section (see
// app/admin/dashboard/page.tsx's RewardsTab), covering all 6 growth
// features' configurable numbers. Deliberately named for the SECTION
// these keys are edited from now, not "PRICING_KEYS" — these moved out
// of Menu & Pricing's box specifically so they're no longer mixed in
// with unrelated pricing rules. Manager already manages every other
// growth-feature control (scheduled_offers via the generic admin CRUD,
// which already allows manager+owner; the Customers tab's loyalty-by-
// phone view) — these settings should be no different.
const REWARDS_KEYS = new Set([
  'first_order_discount_percent',
  'stamp_card_reward_percent',
  'stamp_card_every_n_orders',
  // Stamp-card redesign — the business owner's chosen list of eligible
  // product ids (a JSON-array-in-TEXT value, same pattern as
  // popular_product_ids above), replacing the old flat-percent-only
  // config. See app/api/orders/route.ts and app/admin/dashboard/
  // page.tsx's StampCardSettingsForm.
  'stamp_card_eligible_product_ids',
  'referral_discount_amount',
  'wow_moment_chance_percent',
  'wow_moment_reward_percent',
]);

function managerCanAccessKey(key: string): boolean {
  return HOMEPAGE_KEYS.has(key) || MENU_PRICING_KEYS.has(key) || REWARDS_KEYS.has(key);
}

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
    if (session.role === 'manager' && !managerCanAccessKey(r.key)) continue;
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
    const disallowed = keys.filter((k) => !managerCanAccessKey(k));
    if (disallowed.length) {
      // A real 403, not a silent drop — this is exactly what the "hit a
      // restricted API directly" verification step checks for. A
      // Manager only ever gets this by calling the API by hand (every
      // Manager-visible settings UI — Homepage Display, Pricing rules,
      // Rewards — only ever sends keys from its own allow-listed set).
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
