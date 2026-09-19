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
  ];
}
