import type { ResourceField, RawCategory } from '@/lib/types';

// Shared product field config for components/admin/ResourceManager.tsx's
// "products" table.
//
// Bundle-slug-and-navigation brief, Task 2 — extracted out of
// app/admin/dashboard/page.tsx's MenuTabs (where it used to be a
// component-local const) so that BOTH the inline products list/editor
// (ResourceManager, rendered inside MenuTabs) and the new dedicated
// standalone product-edit route (app/admin/products/[id]/edit/page.tsx)
// build the exact same field list from the exact same source — a page
// that "reuses the existing product form fields" has to import this
// function, not re-type an equivalent-looking array that could quietly
// drift out of sync with the one MenuTabs uses.
//
// Kept as a plain function of `categories` (rather than a static const)
// because the Category field's dropdown options depend on whatever
// categories currently exist — exactly as it did as a MenuTabs-local
// const before this extraction.
export function getProductFields(categories: RawCategory[]): ResourceField[] {
  return [
    { key: 'id', label: 'ID (slug)', type: 'text', required: true },
    { key: 'category_id', label: 'Category', type: 'select', required: true, options: categories.map((c) => ({ value: c.id, label: c.title })) },
    { key: 'name', label: 'Name (English)', type: 'text', required: true },
    { key: 'name_fi', label: 'Name (Finnish, optional)', type: 'text' },
    { key: 'description', label: 'Description (English)', type: 'textarea' },
    { key: 'description_fi', label: 'Description (Finnish, optional)', type: 'textarea' },
    // Option-gating-and-extras-system brief, Task 3 (worker/migrations/
    // 023_extras_and_additional_info.sql) — freeform per-product notes,
    // separate from the ingredients description above (a prep note, an
    // allergen callout, a temporary substitution note — anything that
    // doesn't fit any other field). Plain textarea — this admin panel has
    // no rich-text editor precedent anywhere else (every other long-text
    // field here, including description above, is a plain textarea too),
    // so this deliberately doesn't introduce one.
    {
      key: 'additional_info', label: 'Additional info (English, optional)', type: 'textarea',
      hint: 'Anything else worth telling a customer that doesn’t fit the description above — an allergen note, a prep detail, a temporary substitution. Shown on the product page only when filled in.',
    },
    {
      key: 'additional_info_fi', label: 'Additional info (Finnish, optional)', type: 'textarea',
      hint: 'Anything else worth telling a customer that doesn’t fit the description above — an allergen note, a prep detail, a temporary substitution. Shown on the product page only when filled in.',
    },
    {
      key: 'meta_description', label: 'Meta description (English, optional)', type: 'textarea',
      hint: 'Shown in Google search results — aim for under ~160 characters. Leave blank to use the description above.',
    },
    {
      key: 'meta_description_fi', label: 'Meta description (Finnish, optional)', type: 'textarea',
      hint: 'Shown in Google search results — aim for under ~160 characters. Leave blank to use the description above.',
    },
    { key: 'price', label: 'Price (€)', type: 'number', step: '0.1', required: true },
    { key: 'offer_price', label: 'Offer price (€, optional)', type: 'number', step: '0.1' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'tag', label: 'Tag (optional, e.g. Spicy)', type: 'text' },
    { key: 'has_toppings', label: 'Customizable (pizza-style toppings)', type: 'checkbox' },
    { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
    { key: 'active', label: 'Active (visible on site)', type: 'checkbox', default: true },
    // Priority-fixes brief (roadmap gap analysis), Part 2 — admin SEO
    // fields (worker/migrations/017_admin_seo_fields.sql). Every field
    // below is optional and overrides an auto-derived default when set —
    // see the fallback chain in generateMetadata,
    // app/(site)/[locale]/product/[id]/page.tsx.
    {
      key: 'seo_title', label: 'SEO title (English, optional)', type: 'text',
      hint: 'Overrides the page <title>. Leave blank to use the product name.',
    },
    {
      key: 'seo_title_fi', label: 'SEO title (Finnish, optional)', type: 'text',
      hint: 'Overrides the page <title>. Leave blank to use the product name.',
    },
    {
      key: 'canonical_url', label: 'Canonical URL override (optional)', type: 'text',
      hint: 'Rarely needed — leave blank unless you specifically need this page to point its canonical somewhere other than its own URL.',
    },
    {
      key: 'noindex', label: "Hide from search engines (noindex)", type: 'checkbox',
      hint: 'When checked, this page is excluded from the sitemap and told not to be indexed.',
    },
    {
      key: 'og_image_url', label: 'Social share image override (optional)', type: 'image',
      hint: 'Shown when this page is shared on social media. Leave blank to use the product image above.',
    },
  ];
}
