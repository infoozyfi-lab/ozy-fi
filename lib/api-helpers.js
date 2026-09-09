export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  });
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// `_fi` columns (Phase: bilingual site) are listed alongside their
// English/default counterpart in every table below — see worker/
// schema.sql's comment on those columns for why they're optional and
// never the sole source of truth.
export const ADMIN_TABLES = {
  categories: { cols: ['id', 'title', 'title_fi', 'sub', 'sub_fi', 'image', 'sort_order'] },
  products: {
    cols: [
      'id', 'category_id', 'name', 'name_fi', 'description', 'description_fi', 'price', 'offer_price',
      'image', 'tag', 'has_toppings', 'sort_order', 'active',
    ],
  },
  option_groups: { cols: ['id', 'title', 'title_fi', 'kind', 'icon', 'sort_order'] },
  options: { cols: ['id', 'group_id', 'label', 'label_fi', 'price_delta', 'color', 'sort_order'] },
  addons: { cols: ['id', 'type', 'name', 'name_fi', 'price', 'image', 'active', 'sort_order'] },
  bundles: { cols: ['id', 'title', 'title_fi', 'description', 'description_fi', 'image', 'price', 'slots', 'active', 'sort_order'] },
};

// Same per-datacenter cache purge as the old worker — see app/api/menu/route.js.
export async function purgeMenuCache(request, ctx) {
  const origin = new URL(request.url).origin;
  const cacheKey = new Request(`${origin}/api/menu`, { method: 'GET' });
  const del = caches.default.delete(cacheKey);
  if (ctx && ctx.waitUntil) ctx.waitUntil(del);
  else await del;
}

export function makeOrderNum() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `OZY-${Date.now().toString(36).toUpperCase().slice(-4)}${n}`;
}

// Last-6-digits comparison tolerates the different phone formats the
// checkout form itself accepts, without needing full E.164 normalization.
export function phoneMatches(a, b) {
  const da = String(a || '').replace(/\D/g, '');
  const db = String(b || '').replace(/\D/g, '');
  if (da.length < 6 || db.length < 6) return false;
  return da.slice(-6) === db.slice(-6);
}
