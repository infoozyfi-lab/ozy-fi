// Shared kebab-case slug normalization.
//
// This is the one place that defines what "kebab-case" means for this
// project, so the two callers below can't quietly drift out of sync:
//
//   - app/api/admin/upload/route.ts's `slugifyFilename` calls this for the
//     core normalization step, then layers its own upload-specific rules on
//     top (stripping a file extension, capping length for a storage key,
//     falling back to "image" when the result is empty).
//   - components/admin/ResourceManager.tsx calls this directly for the
//     admin-panel "auto-fill the ID from the name/title/label as you type"
//     feature — no extension-stripping or length cap makes sense there, so
//     it uses the bare normalization as-is.
//
// Deliberately does NOT strip a trailing "extension-shaped" fragment, cap
// length, or fall back to a placeholder on an empty result — callers that
// need any of that (currently just the upload route) add it themselves.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_]+/g, '-') // spaces/underscores -> hyphens
    .replace(/[^a-z0-9-]/g, '') // strip anything not alphanumeric-or-hyphen
    .replace(/-+/g, '-') // collapse repeated hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}
