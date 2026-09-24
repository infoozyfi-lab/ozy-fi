import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, slugify, purgeMenuCache, ADMIN_TABLES } from '@/lib/api-helpers';
import { requireRole, getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/auditLog';
import { validateScheduledOfferInput } from '@/lib/scheduledOffers';
import type { StaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Menu & Pricing (categories/products/option_groups/options/addons/
// bundles, per ADMIN_TABLES) — Kitchen has no reason to read or write
// any of this; Manager and Owner both manage the menu.
const TABLE_ROLES: StaffRole[] = ['manager', 'owner'];

export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const { table: tableName } = await params;

  // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 4 — Staff
  // gets read-only access to exactly the two tables its "menu
  // availability" admin tab needs: products (to toggle `active`) and
  // categories (to group them by name instead of a raw id). Every other
  // table here (option_groups/options/addons/bundles — all price-bearing
  // — and scheduled_offers, which IS a discount) stays Manager/Owner-only,
  // matching the chosen boundary ("...menu availability... but not
  // pricing, discounts..."). Read access isn't itself the restricted
  // thing — a staff member toggling a product off needs to see its name
  // and price for context — only WRITE access is narrowed (see PUT below).
  const session = await getSession(request, env);
  const isStaffMenuRead = session?.role === 'staff' && (tableName === 'products' || tableName === 'categories');
  if (!isStaffMenuRead) {
    const denied = await requireRole(request, env, TABLE_ROLES);
    if (denied) return denied;
  }

  const table = ADMIN_TABLES[tableName];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const rows = await env.DB.prepare(`SELECT * FROM ${tableName} ORDER BY sort_order`).all();
  return json(rows.results);
}

export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, TABLE_ROLES);
  if (denied) return denied;

  const { table: tableName } = await params;
  const table = ADMIN_TABLES[tableName];
  if (!table) return json({ error: 'Unknown table' }, 404);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (!body.id && body.name) {
    body.id = `${slugify(body.name)}-${Date.now().toString(36).slice(-4)}`;
  }
  if (!body.id && body.label) {
    body.id = `${slugify(body.label)}-${Date.now().toString(36).slice(-4)}`;
  }
  if (!body.id) {
    return json({ error: 'id (or name/label) required' }, 400);
  }

  // Same rule as the PUT route (app/api/admin/[table]/[id]/route.js) —
  // an offer price is a discount off the regular price, never higher.
  if (tableName === 'products' && body.offer_price !== null && body.offer_price !== undefined && body.offer_price !== '') {
    if (Number(body.offer_price) > Number(body.price || 0)) {
      return json({ error: 'Offer price cannot be higher than the regular price.' }, 400);
    }
  }

  // Growth features batch 2 (Feature 5) — day-array/time-window/percent
  // validation, same "inline per-table check in the generic route" style
  // as the products check above (see lib/scheduledOffers.ts for the
  // shared rules, also used by the PUT route below).
  if (tableName === 'scheduled_offers') {
    const validationError = validateScheduledOfferInput(body);
    if (validationError) return json({ error: validationError }, 400);
  }

  const cols = table.cols.filter((c) => c in body);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => body[c]);

  // Save-failed bug report — this INSERT had no try/catch, so a real D1
  // error (most concretely: a `${tableName}.id` PRIMARY KEY collision —
  // e.g. SizesEditor.tsx's addTier() always creates a product's size
  // group as `size-<productId>`, deterministically, so it collides if a
  // group with that exact id already exists but wasn't found by that
  // product's own scoped lookup, such as a pre-migration-021 'size' group
  // whose product_id backfilled to NULL — see worker/migrations/
  // 021_option_group_product_id.sql's own comment) propagated as an
  // UNCAUGHT exception. In a live Worker that becomes a raw, non-JSON
  // error response — exactly what SizesEditor's `data.error || 'Save
  // failed.'` fallback can't do anything with, since there's no `.error`
  // to read. Confirmed for real (not just reasoned about): a runtime
  // harness that executes this actual route against a real PK collision
  // reproduces this exact uncaught-exception shape — see
  // worker/test-data/save-failed-bug-verify.js.
  //
  // Catching it here and returning a normal `json({error}, 500)` doesn't
  // change any successful-path behavior at all — it only means a genuine
  // write failure now surfaces the real reason instead of a generic,
  // undiagnosable client-side message.
  try {
    await env.DB.prepare(
      `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`
    ).bind(...values).run();
  } catch (err: any) {
    return json({ error: err?.message || `Could not create this ${tableName} row.` }, 500);
  }

  await purgeMenuCache(request, ctx);

  const session = await getSession(request, env);
  const label = body.name || body.label || body.id;
  ctx.waitUntil(logActivity(env, session, `${tableName}.created`, `Created ${tableName} "${label}"`));

  return json({ ok: true, id: body.id }, 201);
}
