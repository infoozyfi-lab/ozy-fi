import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.IMAGES) {
    return new Response(JSON.stringify({ error: 'Image storage is not configured.' }), {
      status: 500,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });
  }

  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
  const object = await env.IMAGES.get(key);

  if (!object) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
