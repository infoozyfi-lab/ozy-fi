import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import ProductPageStandalone from '@/components/ProductPageStandalone';
import { buildBreadcrumbSchema, type BreadcrumbItem } from '@/components/Breadcrumbs';
import { loadMenuData } from '@/lib/menu-data';
import { resolveText, hreflangAlternates, getDictionary } from '@/lib/i18n/locales';
import type { StoreProviderInitialData } from '@/context/StoreContext';
import type { RawProduct } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Matches every other JSON-LD block in this codebase (productSchema
// below, menuSchema in the category page) — all hardcode this same origin
// rather than deriving it, so this keeps that one existing convention
// instead of adding a second way to build the same URL.
const SITE_ORIGIN = 'https://ozy.fi';

async function getProduct(id: string): Promise<RawProduct | null> {
  const { env } = await getCloudflareContext({ async: true });
  // Typed generic on .first() so the D1 row (defaults to
  // Record<string, unknown>) is assignable to this function's
  // Promise<RawProduct | null> return type without a separate cast.
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND active = 1').bind(id).first<RawProduct>();
  return row || null;
}

// SEO gap-fill, Part A — a small, single-purpose lookup just for the
// breadcrumb's middle crumb (the product's category name), separate from
// the heavier loadMenuData() call below. Wrapped in try/catch like that
// call, for the same reason: this is non-essential ornamentation for the
// page (Home > Product still renders correctly without it), not something
// a real failure here should ever turn into a 500 or a false 404 for.
async function getCategoryTitle(categoryId: string): Promise<{ title: string; title_fi: string | null } | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const row = await env.DB.prepare('SELECT title, title_fi FROM categories WHERE id = ?')
      .bind(categoryId)
      .first<{ title: string; title_fi: string | null }>();
    return row || null;
  } catch (err) {
    console.error(`[product breadcrumb] failed to load category "${categoryId}":`, err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return { title: locale === 'fi' ? 'Tuote | ozy.fi' : 'Menu item | ozy.fi' };
  }

  const name = resolveText(product.name, product.name_fi, locale);
  // Priority-fixes brief (roadmap gap analysis), Part 2 — an admin-set
  // seo_title/seo_title_fi (worker/migrations/017_admin_seo_fields.sql)
  // now overrides the auto-derived "<name> — ozy.fi" title when present;
  // an unmodified product (both fields still NULL) renders the exact
  // same title as before this field existed.
  const seoTitleOverride = resolveText(product.seo_title, product.seo_title_fi, locale);
  const title = seoTitleOverride || `${name} — ozy.fi`;
  // SEO meta description fallback chain (worker/migrations/
  // 014_product_meta_description.sql): a purpose-written meta_description
  // first, since a good search-result snippet reads differently from an
  // ingredients list; then the ingredients description (today's existing
  // behavior); then the generic auto-generated sentence. This means a
  // product the business owner hasn't filled meta_description in for yet
  // renders exactly as it did before this field existed.
  const metaDesc = resolveText(product.meta_description, product.meta_description_fi, locale);
  const desc = resolveText(product.description, product.description_fi, locale);
  const description = metaDesc || desc || (locale === 'fi'
    ? `Tilaa ${name} verkosta kotiinkuljetuksena tai noutona ozy.fi:stä.`
    : `Order ${name} online for delivery or pickup from ozy.fi.`);

  // Part 2 continued — canonical_url override (rare; admin's own
  // responsibility if used) and og_image_url override (falls back to the
  // product's own image exactly as before this field existed).
  const canonicalOverride = product.canonical_url || undefined;
  const ogImage = product.og_image_url || product.image || undefined;
  const isNoindex = Boolean(Number(product.noindex));

  return {
    title,
    description,
    alternates: {
      canonical: canonicalOverride || `/${locale}/product/${id}`,
      languages: hreflangAlternates(`/product/${id}`),
    },
    // Part 2 — noindex toggle. Only ever sets `index: false`; never
    // forces `index: true`, so this can't accidentally override some
    // other, more specific reason a page shouldn't be indexed in the
    // future.
    ...(isNoindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url: `https://ozy.fi/${locale}/product/${id}`,
      locale: locale === 'fi' ? 'fi_FI' : 'en_US',
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    // Priority-fixes brief, Part 6 — Twitter/X Card metadata, reusing
    // the exact same title/description/image already computed above
    // rather than duplicating the fallback logic a second time.
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  // Not wrapped in try/catch — see the identical note in
  // app/(site)/[locale]/menu/[category]/page.js: a real D1 failure here
  // must not be mistaken for "this product doesn't exist" and silently
  // turned into a 404. It now propagates to
  // app/(site)/[locale]/error.js instead (bug-fix, bilingual-site crash,
  // Sept 2026).
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  // Same defensive fallback as the other page.js files for this second,
  // non-essential D1 call — see app/(site)/[locale]/page.js.
  let initialData: StoreProviderInitialData | null = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    initialData = await loadMenuData(env);
  } catch (err) {
    console.error(`[/${locale}/product/${id}] failed to load SSR menu data:`, err);
  }

  const name = resolveText(product.name, product.name_fi, locale);
  const description = resolveText(product.description, product.description_fi, locale);

  // SEO gap-fill, Part A — Home > Category > Product. Same exact-match
  // principle as the category page: this one array feeds both the
  // visible trail (ProductPageStandalone -> Breadcrumbs) and the JSON-LD
  // below. The category crumb is only included when the category lookup
  // above actually found something — a category-lookup failure degrades
  // to Home > Product rather than showing a broken/unlabeled crumb, on
  // both the visible trail and the structured data together (so they
  // still match each other even in that fallback case).
  const t = getDictionary(locale);
  const category = await getCategoryTitle(product.category_id);
  const categoryTitle = category ? resolveText(category.title, category.title_fi, locale) : null;
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t.breadcrumb.home, href: `/${locale}` },
    ...(categoryTitle ? [{ label: categoryTitle, href: `/${locale}/menu/${product.category_id}` }] : []),
    { label: name, href: `/${locale}/product/${id}` },
  ];
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems, SITE_ORIGIN);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description || undefined,
    image: product.image || undefined,
    // Round-2 fixes brief, Part 7 — Product JSON-LD had no `category`
    // field even though the page already resolves the category name for
    // the breadcrumb (categoryTitle, above). Reusing that same value here
    // rather than re-querying, and omitting the field entirely (rather
    // than emitting an empty string) in the same fallback case where the
    // breadcrumb itself degrades to Home > Product.
    category: categoryTitle || undefined,
    inLanguage: locale,
    offers: {
      '@type': 'Offer',
      price: Number(product.offer_price || product.price).toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: `https://ozy.fi/${locale}/product/${id}`,
    },
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ProductPageStandalone
        productId={id}
        productHint={{ ...product, name, description }}
        initialData={initialData}
        breadcrumbItems={breadcrumbItems}
      />
    </>
  );
}
