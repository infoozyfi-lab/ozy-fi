import Link from 'next/link';

// SEO gap-fill, Part A — visible breadcrumb trail (Home > Category >
// Product) on the category and product pages, using real <a> elements
// (next/link renders a genuine <a href>, present in the server-rendered
// HTML even though MenuPageClient/ProductPageStandalone are Client
// Components — Next.js still server-renders their markup on first load,
// so this is crawlable, not JS-only).
//
// `href` is required on every item, including the current (last) page —
// buildBreadcrumbSchema below uses it to build that item's JSON-LD `item`
// URL too, even though the visible trail never links the current page.
export interface BreadcrumbItem {
  label: string;
  href: string;
}

export default function Breadcrumbs({ items }: { items?: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="wrap breadcrumbs">
      <ol>
        {items.map((item, i) => (
          <li key={item.href}>
            {i === lastIndex ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
            {i < lastIndex && <span className="breadcrumbs-sep" aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Builds schema.org BreadcrumbList JSON-LD from the exact same `items`
// array passed to <Breadcrumbs> above, so the structured data can never
// describe a trail different from what's actually visible on the page —
// each ListItem's `name` is the same label, in the same order, one per
// visible crumb, nothing added or removed. `origin` matches every other
// JSON-LD block already in this codebase (productSchema/menuSchema's
// hardcoded `https://ozy.fi` — see app/(site)/[locale]/product/[id]/
// page.tsx and .../menu/[category]/page.tsx).
export function buildBreadcrumbSchema(items: BreadcrumbItem[], origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: `${origin}${item.href}`,
    })),
  };
}
