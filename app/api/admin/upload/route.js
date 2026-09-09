import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function extFromContentType(type) {
  switch (type) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return 'bin';
  }
}

// Used for menu/category/addon photos (Manager, Owner) and the homepage
// featured-banner image (also Manager, Owner) — Kitchen never uploads
// anything.
export async function POST(request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['manager', 'owner']);
  if (denied) return denied;

  if (!env.IMAGES) {
    return json({ error: 'Image storage is not configured. Add an IMAGES R2 bucket binding.' }, 500);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400);
  }

  const form = await request.formData().catch(() => null);
  const file = form ? form.get('file') : null;

  if (!file || typeof file === 'string') {
    return json({ error: 'No file provided.' }, 400);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return json({ error: 'Only JPEG, PNG, WEBP or GIF images are allowed.' }, 400);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return json({ error: 'Image is too large (max 5MB).' }, 400);
  }

  const ext = extFromContentType(file.type);
  const key = `uploads/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  await env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return json({ ok: true, url: `/images/${key}` }, 201);
}
