import { getCloudflareContext } from '@opennextjs/cloudflare';

// This route reads live data from D1 on every request — it must never be
// statically prerendered at build time.
export const dynamic = 'force-dynamic';

// Ported 1:1 from worker/index.js's getMenu() — same D1 queries, same
// response shape, same edge-cache behavior. The old hand-written Worker
// still serves this route on production; this copy only runs on the
// SSR preview branch/deployment until it's verified and swapped in.
export async function GET(request) {
  const { env, ctx } = await getCloudflareContext({ async: true });

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [
    categories,
    products,
    groups,
    options,
    addons,
    bundles,
    settingsRows,
  ] = await Promise.all([
    env.DB.prepare('SELECT * FROM categories ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM option_groups ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM options ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM addons WHERE active = 1 ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM bundles WHERE active = 1 ORDER BY sort_order').all(),
    env.DB.prepare('SELECT key, value FROM admin_settings').all(),
  ]);

  const optionsByGroup = {};
  for (const o of options.results) {
    (optionsByGroup[o.group_id] ||= []).push(o);
  }
  const optionGroups = groups.results.map((g) => ({
    ...g,
    options: optionsByGroup[g.id] || [],
  }));

  const settings = {};
  for (const row of settingsRows.results) {
    settings[row.key] = row.value;
  }

  const payload = JSON.stringify({
    categories: categories.results,
    products: products.results,
    optionGroups,
    addons: addons.results,
    bundles: bundles.results,
    settings,
  });

  const response = new Response(payload, {
    status: 200,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'Cache-Control': 'public, max-age=60, s-maxage=90',
    },
  });

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
