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

// `stripExtension` defaults on for the original use (a real uploaded
// filename, which may end in ".jpg" etc.) but is turned off when this is
// called on name+description hint text (see nameHint/descriptionHint
// below) — that text was never a filename, so trimming a trailing
// "extension-shaped" fragment off it (e.g. a description that happens to
// end in "v2." or a decimal) would be wrong, not helpful.
function slugifyFilename(name: string, stripExtension = true): string {
  // Drop a trailing extension if the original name had one — the real
  // extension used in the final key comes from the validated content-type
  // (extFromContentType), not from whatever the browser/OS put on the
  // original file, so there's no reason to carry a second one into the slug.
  const withoutExt = stripExtension ? name.replace(/\.[^./\\]+$/, '') : name;

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

// A FormData field that's genuinely absent comes back `null`; one a
// browser/client sent as an empty string is still `''`. Both mean "no
// hint" here, and a non-string (shouldn't happen for these two fields,
// but FormData is untyped) is treated the same way rather than throwing.
function formHintText(form: FormData | null, key: string): string {
  const value = form ? form.get(key) : null;
  return typeof value === 'string' ? value.trim() : '';
}

// Auto-SEO-filename fix — the admin panel already knows a product's name
// and ingredients (or a bundle's title, or the homepage banner's title)
// at the moment an image is uploaded for it, so the upload requests from
// components/admin/ResourceManager.tsx, components/admin/BundleManager.tsx
// and app/admin/dashboard/page.tsx's banner uploader all send that text
// along as `nameHint`/`descriptionHint` form fields, ahead of a camera-roll
// filename like "IMG_4521.jpg" that carries no useful SEO information.
// `nameHint` alone (no description) is enough to prefer the hint — the
// description is just extra keywords tacked on when there is one.
function buildHintedSlug(form: FormData | null, file: File): string {
  // Menu items on this project are commonly named with a leading
  // sort-order/category code, e.g. "10. Quattro", "B1. Texas Style BBQ",
  // "PE2. Pesto Veggie" (see data/menu.ts) — meaningful for menu
  // organization but not for an SEO filename, so strip a leading
  // "<optional short letter code><digits>. " (or ") " / " - ") pattern
  // before slugifying, without touching the actual product name shown
  // anywhere else.
  const rawNameHint = formHintText(form, 'nameHint');
  const nameHint = rawNameHint.replace(/^\s*[A-Za-z]{0,4}\d+\s*[.)-]\s*/, '').trim();
  if (!nameHint) {
    // No name yet (e.g. a brand-new, not-yet-named product), or the name
    // was nothing but the leading number — same fallback as before this
    // feature existed: slugify the file's own name.
    return slugifyFilename(file.name || '');
  }
  const descriptionHint = formHintText(form, 'descriptionHint');
  const hintText = descriptionHint ? `${nameHint} ${descriptionHint}` : nameHint;
  return slugifyFilename(hintText, false);
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
  // Prefer an SEO-meaningful name/description hint sent alongside the
  // file over the file's own (often meaningless, e.g. "IMG_4521.jpg")
  // name — see buildHintedSlug. Falls back to slugifying file.name when
  // no hint was sent, exactly as before this feature existed, so uploads
  // from paths that don't send hints keep working unchanged.
  const slug = buildHintedSlug(form, file);
  const suffix = crypto.randomUUID().slice(0, 8);
  const key = `uploads/${slug}-${suffix}.${ext}`;

  await env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return json({ ok: true, url: `/images/${key}` }, 201);
}
