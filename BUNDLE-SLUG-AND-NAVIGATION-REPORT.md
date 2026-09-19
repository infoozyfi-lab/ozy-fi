# Bundle-slug-and-navigation — delivery report

Two independent tasks, each scoped to its own files.

## Task 1 — Extend the auto-ID-slug behavior to Bundles

`components/admin/ResourceManager.tsx`'s "New" form already auto-filled a resource's `id` (slug) field as a kebab-case version of its title/name field while the admin typed, stopping that auto-fill the moment they edited `id` themselves. `components/admin/BundleManager.tsx` had its own separate "New bundle" form that never got this — a new bundle's `id` had to be typed by hand.

Brought the same pattern over: a new `idTouched` flag (mirroring `ResourceManager.tsx`'s own tracked-touch state) tracks whether the admin has edited the ID field themselves during the current "New bundle" session; until they do, typing in the Title field live-fills `id` via the same shared `lib/slugify.ts` helper `ResourceManager.tsx` and the image-upload route both already use, so bundle IDs get the same consistent slug shape as every other resource. Editing an *existing* bundle is unaffected — the ID field stays disabled once a bundle exists, exactly as before, so this only changes the "New bundle" flow.

**Files:** `components/admin/BundleManager.tsx`.

## Task 2 — Dedicated product edit page

**The reported problem:** editing a product happened in an in-place modal/inline form driven entirely by the admin dashboard's own client-side `tab`/`editingId` state. That has no real browser-history entry — the mobile OS back gesture (and the browser's own back button) skipped straight past the edit form to wherever the dashboard was before it opened at all, with no reliable way to land back on the exact tab an admin had been on.

**Fix:** a real Next.js route, `app/admin/products/[id]/edit/page.tsx`, following the same conventions already established by this project's other standalone admin routes (e.g. `app/admin/orders/[id]/invoice/page.tsx`): a client component with its own `/api/admin/me` auth check (the underlying API routes already enforce this server-side regardless — this just gives a real "please sign in" state instead of a wall of failed fetches), English-only (the admin panel is deliberately not bilingual), using `useParams()`/`useSearchParams()` for its dynamic segment and query string.

Deliberately did **not** rewrite the form itself: this new route renders the exact same `components/admin/ResourceForm.tsx` component (fields, validation, image upload, ID handling, save) that `ResourceManager.tsx` already uses inline for every other resource, driven by the same `lib/admin-resource-fields.ts` field config (`getProductFields`) the dashboard's own Products tab calls. That was the deliberate choice to avoid this new page quietly drifting out of sync with what the inline editor shows for the same product type.

**Files:** new `app/admin/products/[id]/edit/page.tsx`.

---

## Verification

Both changes were checked with a full-file TypeScript `strict: true` syntax/type check (`ts.transpileModule`) — zero errors on either touched file. Not exercised in a live browser: the actual back-button/navigation-history behavior the new route is meant to fix, and the live slug auto-fill while typing in the bundle form, were both verified by reading the logic rather than clicking through it.

These two tasks predate, and are unrelated in scope to, the separate seven-part audit-fixes brief delivered alongside this report — see `AUDIT-FIXES-REPORT.md` for that work. Both this brief's files were confirmed still intact and untouched by the audit-fixes changes before packaging.
