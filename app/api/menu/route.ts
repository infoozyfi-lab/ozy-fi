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
      // Bug fix (per-product-size follow-up brief) — this used to be
      // `public, max-age=300, s-maxage=300`. `max-age` (no distinct
      // `s-maxage` before this fix meant BOTH shared and private/browser
      // caches treated the response as fresh for 300s) is what a
      // customer's own BROWSER obeys — with `max-age=300` set, a browser
      // that had already fetched this response once would reuse its own
      // cached copy for up to 5 minutes and never even ask the server
      // again, regardless of anything `purgeMenuCache` does server-side
      // on an admin edit (a server-side cache purge cannot reach into an
      // already-cached browser response — there is no push mechanism).
      // That's the concrete reason a newly-added size tier (or any other
      // menu edit) didn't show up on a customer's page even immediately
      // after saving it in the admin panel: the customer's OWN browser
      // was still serving its last cached /api/menu response and hadn't
      // made a new request at all.
      //
      // `max-age=0` now makes every browser treat this response as
      // immediately stale, so it always issues a real request on the
      // next fetch — the edge (`s-maxage=300` + the `caches.default`
      // logic below, purged instantly by `purgeMenuCache`) is what
      // still avoids re-querying D1 on every single request, which was
      // this cache's actual original goal. `must-revalidate` reinforces
      // that a stale copy is never reused without checking back in,
      // rather than relying on `max-age=0`'s implication alone.
      //
      // One residual caveat, NOT fixed by this header change and worth
      // being explicit about: `caches.default` (the Cache API used
      // below) is a PER-DATACENTER cache — `purgeMenuCache`'s
      // `cache.delete()` only clears the copy at whichever Cloudflare
      // colo handled that specific admin request. A customer whose
      // request lands on a DIFFERENT colo within the following 5
      // minutes can still get that colo's own not-yet-expired cached
      // copy. This fix guarantees the customer's browser always asks
      // *a* server for a fresh check; it does not guarantee every
      // Cloudflare colo agrees on the answer within the same instant.
      // Closing that last gap would mean moving off the Workers Cache
      // API entirely (e.g. a version-tagged KV/R2 cache with real global
      // invalidation) — a much bigger change than this bug report's
      // scope, and not undertaken here.
      'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate',
    },
  });

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
