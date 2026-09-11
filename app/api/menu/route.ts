import { getCloudflareContext } from '@opennextjs/cloudflare';
import { loadMenuData } from '@/lib/menu-data';

// This route reads live data from D1 on every request — it must never be
// statically prerendered at build time.
export const dynamic = 'force-dynamic';

// Ported 1:1 from worker/index.js's getMenu() — same D1 queries, same
// response shape, same edge-cache behavior. The old hand-written Worker
// still serves this route on production; this copy only runs on the
// SSR preview branch/deployment until it's verified and swapped in.
export async function GET(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const data = await loadMenuData(env);
  const payload = JSON.stringify(data);

  const response = new Response(payload, {
    status: 200,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      // Cached aggressively (browser + edge) since admin edits already
      // purge this instantly (see purgeMenuCache) — a longer max-age here
      // just means repeat visits (e.g. product page → product page)
      // reuse the same response instead of re-downloading the whole
      // menu every time.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
