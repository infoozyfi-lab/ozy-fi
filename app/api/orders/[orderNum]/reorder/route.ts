import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json, phoneMatches } from '@/lib/api-helpers';
import { loadMenuData } from '@/lib/menu-data';
import { normalizeMenuBlob } from '@/lib/menu-i18n';
import { computeCurrentProductPrice, computeCurrentBundlePrice } from '@/lib/pricing';
import type { OrderRow, OrderItemRow, CartLine } from '@/lib/types';

export const dynamic = 'force-dynamic';

// The `{ selection?, bundleId?, bundleItems? }` blob stored in
// order_items.selection_json at order-creation time (see
// app/api/orders/route.ts) — untrusted-shape JSON from D1, same "don't
// assume it's well-formed" treatment request bodies get elsewhere in this
// project (a row written before this column existed is simply NULL/empty,
// same as a fresh order's line with no selection sent at all).
interface StoredLineExtras {
  selection?: unknown;
  bundleId?: string;
  bundleItems?: unknown;
}

function parseDetails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

function parseExtras(raw: string | null | undefined): StoredLineExtras {
  if (!raw) return {};
  try {
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? (d as StoredLineExtras) : {};
  } catch {
    return {};
  }
}

// Feature 1 — "Reorder this" (see TrackPageClient.tsx). Rebuilds a fresh
// cart from a past order's items, priced at TODAY's menu (never the
// historical order's own line_total/price), and skips any item whose
// product/bundle no longer exists rather than failing the whole reorder.
// Same auth as GET /api/orders/[orderNum] — order number alone isn't
// enough, the phone number used at checkout is required too.
export async function GET(request: Request, { params }: { params: { orderNum: string } }) {
  const { env } = await getCloudflareContext({ async: true });

  const url = new URL(request.url);
  const phone = url.searchParams.get('phone') || '';

  const order = await env.DB.prepare('SELECT * FROM orders WHERE order_num = ?')
    .bind(params.orderNum)
    .first<OrderRow>();

  if (!order || !phoneMatches(order.phone, phone)) {
    return json({ error: 'Order not found' }, 404);
  }

  const itemRows = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?')
    .bind(order.id)
    .all<OrderItemRow>();

  const rawMenu = await loadMenuData(env);
  const menu = normalizeMenuBlob(rawMenu, 'en'); // locale only affects display labels, never ids/prices.

  const cart: CartLine[] = [];
  let skippedCount = 0;

  itemRows.results.forEach((row, i) => {
    const extras = parseExtras(row.selection_json);
    const details = parseDetails(row.details);
    const now = Date.now();

    if (extras.bundleId) {
      const resolved = computeCurrentBundlePrice(extras.bundleId, extras.bundleItems, menu);
      if (!resolved.ok || resolved.unitPrice === undefined) {
        skippedCount += 1;
        return;
      }
      const lineTotal = Math.round(resolved.unitPrice * row.qty * 100) / 100;
      cart.push({
        key: `reorder-${resolved.bundleId}-${now}-${i}`,
        productId: resolved.bundleId,
        name: resolved.name || row.name,
        image: resolved.image ?? null,
        details,
        qty: row.qty,
        unitPrice: resolved.unitPrice,
        lineTotal,
        bundleId: resolved.bundleId,
        bundleItems: resolved.bundleItems,
      });
      return;
    }

    const resolved = computeCurrentProductPrice(row.product_id, extras.selection, menu);
    if (!resolved.ok || resolved.unitPrice === undefined) {
      skippedCount += 1;
      return;
    }
    const lineTotal = Math.round(resolved.unitPrice * row.qty * 100) / 100;
    cart.push({
      key: `reorder-${resolved.productId}-${now}-${i}`,
      productId: resolved.productId,
      name: resolved.name || row.name,
      image: resolved.image ?? null,
      details,
      qty: row.qty,
      unitPrice: resolved.unitPrice,
      lineTotal,
      selection: resolved.selection,
    });
  });

  if (cart.length === 0) {
    return json({ error: 'None of the items from this order are available anymore.' }, 400);
  }

  return json({ cart, skippedCount, addedCount: cart.length });
}
