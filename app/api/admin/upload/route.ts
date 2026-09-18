import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function extFromContentType(type: string): string {
  switch (type) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return 'bin';
  }
}

// Filename-SEO fix — the business owner names product images carefully
// before uploading (e.g. "margherita-pizza-tomaatti-mozzarella-basilika.webp")
// so that name should survive into the storage key (and therefore the live
// URL), not get thrown away for a fully random one. This only builds the
// readable part of the key; a short random suffix (added where this is
// called) is still what actually prevents collisions.
const MAX_SLUG_LENGTH = 80;

function slugifyFilename(name: string): string {
  // Drop a trailing extension if the original name had one — the real
  // extension used in the final key comes from the validated content-type
  // (extFromContentType), not from whatever the browser/OS put on the
  // original file, so there's no reason to carry a second one into the slug.
  const withoutExt = name.replace(/\.[^./\\]+$/, '');

  let slug = withoutExt
    .toLowerCase()
    .replace(/[\s_]+/g, '-') // spaces/underscores -> hyphens
    .replace(/[^a-z0-9-]/g, '') // strip anything not alphanumeric-or-hyphen
    .replace(/-+/g, '-') // collapse repeated hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  if (slug.length > MAX_SLUG_LENGTH) {
    const cut = slug.slice(0, MAX_SLUG_LENGTH);
    // Prefer cutting at a hyphen boundary so a long name doesn't end
    // mid-word — but only look back a short way for one, so an unusually
    // long single "word" (or a name with no hyphens at all) still just
    // gets a clean hard cut instead of being chopped down further than
    // necessary.
    const lastHyphen = cut.lastIndexOf('-');
    slug = lastHyphen > MAX_SLUG_LENGTH - 20 ? cut.slice(0, lastHyphen) : cut;
    slug = slug.replace(/-+$/, '');
  }

  // Empty, symbols-only, or missing original name — fall back to something
  // reasonable rather than producing an all-but-empty key.
  return slug || 'image';
}

// Used for menu/category/addon photos (Manager, Owner) and the homepage
// featured-banner image (also Manager, Owner) — Kitchen never uploads
// anything.
export async function POST(request: Request) {
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
  // file.name comes from the FormData entry — not always present depending
  // on how the upload was built client-side, so this still falls back
  // cleanly via slugifyFilename('') -> 'image' rather than erroring.
  const slug = slugifyFilename(file.name || '');
  const suffix = crypto.randomUUID().slice(0, 8);
  const key = `uploads/${slug}-${suffix}.${ext}`;

  await env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return json({ ok: true, url: `/images/${key}` }, 201);
}
