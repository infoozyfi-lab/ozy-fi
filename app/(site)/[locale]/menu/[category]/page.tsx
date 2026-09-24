import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import MenuPageClient from '@/components/MenuPageClient';
import { buildBreadcrumbSchema, type BreadcrumbItem } from '@/components/Breadcrumbs';
import { loadMenuData } from '@/lib/menu-data';
import { resolveText, hreflangAlternates, getDictionary } from '@/lib/i18n/locales';
import type { StoreProviderInitialData } from '@/context/StoreContext';
import type { RawCategory } from '@/lib/types';

// Every JSON-LD block already in this codebase hardcodes this same origin
// (productSchema in the product page, this file's own menuSchema below) —
// matching that rather than introducing a second convention.
const SITE_ORIGIN = 'https://ozy.fi';

export const dynamic = 'force-dynamic';

// SEO/GEO "direct answer" intros — short (40-60 word), keyword-natural
// paragraphs for the 3 main category hub pages (per the SEO Master Plan's
// Phase 4: "GEO Answer Blocks" — this is the piece meant to be the "easy
// quote" an AI answer engine like ChatGPT/Perplexity can lift directly).
// Keyed by the actual category id used in the database (see
// worker/seed.sql) — deliberately only the 3 hub categories the plan
// calls out; any other category (e.g. voner, kanakebab) simply gets no
// intro (introText stays null), same as before this change, rather than
// guessing at copy for categories the plan didn't ask for.
const CATEGORY_SEO_COPY: Record<string, { fi: string; en: string }> = {
  pizzat: {
    fi: 'ozy.fi tarjoaa tuoreet, uunista suoraan tulevat pizzat Helsingissä — klassinen tomaattipohja, runsaasti täytevaihtoehtoja ja nopea kotiinkuljetus tai nouto. Tilaa verkossa ja valitse haluamasi koko, pohja ja täytteet muutamalla klikkauksella.',
    en: 'ozy.fi serves fresh, oven-baked pizza in Helsinki — a classic tomato base, a wide choice of toppings, and fast delivery or pickup. Order online and customize your size, base, and toppings in just a few taps.',
  },
  kebab: {
    fi: 'ozy.fi:n kebab valmistetaan tuoreista raaka-aineista ja tarjoillaan runsaalla täytteellä — salaatti, tomaatti, chili ja valitsemasi kastike. Tilaa kotiinkuljetuksena tai noutona Helsingissä, valmis muutamassa minuutissa.',
    en: "ozy.fi's kebab is made with fresh ingredients and served fully loaded — lettuce, tomato, chili, and your choice of sauce. Order for delivery or pickup in Helsinki, ready in minutes.",
  },
  burgerit: {
    fi: 'ozy.fi:n burgerit valmistetaan tuoreista raaka-aineista mehukkaalla pihvillä, salaatilla, tomaatilla ja burgerikastikkeella. Ateriaan sisältyy aina ranskalaiset ja juoma. Tilaa kotiinkuljetuksena tai noutona Helsingissä.',
    en: "ozy.fi's burgers are made fresh with a juicy patty, lettuce, tomato, and burger sauce. Every meal includes fries and a drink. Order for delivery or pickup in Helsinki.",
  },
};

async function getCategory(slug: string): Promise<RawCategory | null> {
  const { env } = await getCloudflareContext({ async: true });
  // Typed generic on .first() so the D1 row (defaults to
  // Record<string, unknown>) is assignable to this function's
  // Promise<RawCategory | null> return type without a separate cast.
  const row = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(slug).first<RawCategory>();
  return row || null;
}

// Round-2 fixes brief, Part 3 — "Add cross-links between related
// categories where it genuinely makes sense... don't force links that
// don't make sense." Rather than hardcoding a specific pair (the brief's
// own example, vegaani -> voner, doesn't actually hold against this
// project's real seed data — voner's own products aren't tagged Vegan at
// all), this computes real overlap: other categories that have at least
// one ACTIVE product sharing a real `tag` value (Vegan/Vegetarian/Spicy/
// Signature, etc. — whatever's actually set) with an active product in
// THIS category. Ordered by how much they actually overlap, capped to 3
// so this never turns into a wall of links. Genuinely empty (most
// categories, which use tags sparingly) simply renders nothing — no
// fallback/invented relationship.
interface RelatedCategoryRow {
  id: string;
  title: string;
  title_fi: string | null;
  overlap: number;
}

async function getRelatedCategories(categorySlug: string): Promise<RelatedCategoryRow[]> {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    `SELECT c.id AS id, c.title AS title, c.title_fi AS title_fi, COUNT(*) AS overlap
     FROM products p
     JOIN products p2 ON p2.tag = p.tag AND p2.category_id != p.category_id AND p2.active = 1
     JOIN categories c ON c.id = p2.category_id
     WHERE p.category_id = ? AND p.tag IS NOT NULL AND p.active = 1
     GROUP BY c.id
     ORDER BY overlap DESC
     LIMIT 3`
  ).bind(categorySlug).all<RelatedCategoryRow>();
  return results || [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { locale, category: categorySlug } = await params;
  const category = await getCategory(categorySlug);

  if (!category) {
    return { title: locale === 'fi' ? 'Ruokalista | ozy.fi' : 'Menu | ozy.fi' };
  }

  const title = resolveText(category.title, category.title_fi, locale);
  const sub = resolveText(category.sub, category.sub_fi, locale);
  // Priority-fixes brief (roadmap gap analysis), Part 2 — admin SEO
  // fields (worker/migrations/017_admin_seo_fields.sql). Categories had
  // NONE of this before (not even a meta description) — an unmodified
  // category (every new field still NULL) renders exactly as it did
  // before this migration.
  const seoTitleOverride = resolveText(category.seo_title, category.seo_title_fi, locale);
  const pageTitle = seoTitleOverride || (locale === 'fi' ? `${title} — Ruokalista | ozy.fi` : `${title} Menu — ozy.fi`);
  const metaDescOverride = resolveText(category.meta_description, category.meta_description_fi, locale);
  const description = metaDescOverride || sub || (locale === 'fi'
    ? `Selaa ${title}-valikoimaamme ja tilaa verkosta kotiinkuljetuksena tai noutona.`
    : `Browse our ${title} menu and order online for delivery or pickup.`);
  const canonicalOverride = category.canonical_url || undefined;
  const ogImage = category.og_image_url || category.image || undefined;
  const isNoindex = Boolean(Number(category.noindex));

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: canonicalOverride || `/${locale}/menu/${categorySlug}`,
      languages: hreflangAlternates(`/menu/${categorySlug}`),
    },
    ...(isNoindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: pageTitle,
      description,
      url: `https://ozy.fi/${locale}/menu/${categorySlug}`,
      locale: locale === 'fi' ? 'fi_FI' : 'en_US',
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    // Priority-fixes brief, Part 6 — Twitter/X Card metadata, reusing
    // the same values already computed above.
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: pageTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function CategoryMenuPage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { locale, category: categorySlug } = await params;

  // Not wrapped in try/catch: if getCategory() itself throws (a real D1
  // failure), we deliberately let that propagate to
  // app/(site)/[locale]/error.js rather than swallow it and call
  // notFound() — a database error is not the same thing as "this category
  // genuinely doesn't exist", and treating it as a 404 would hide a real
  // problem behind a misleading "not found" page (bug-fix, bilingual-site
  // crash, Sept 2026 — see error.js's comment for why that boundary now
  // exists to catch this safely instead of it reaching global-error.js).
  const category = await getCategory(categorySlug);

  if (!category) {
    notFound();
  }

  // This second D1 call (the full menu blob, for SSR-seeding the page)
  // gets the same defensive fallback as the other page.js files — see
  // app/(site)/[locale]/page.js for the full reasoning.
  let initialData: StoreProviderInitialData | null = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    initialData = await loadMenuData(env);
  } catch (err) {
    console.error(`[/${locale}/menu/${categorySlug}] failed to load SSR menu data:`, err);
  }

  // Round-2 fixes brief, Part 3 — non-critical (purely an SEO/discovery
  // enhancement, nothing the page depends on to function), so a query
  // failure here degrades to "no related categories shown" rather than
  // taking down the whole page — same defensive pattern as initialData
  // above.
  let relatedCategories: { id: string; title: string }[] = [];
  try {
    const rows = await getRelatedCategories(categorySlug);
    relatedCategories = rows.map((r) => ({ id: r.id, title: resolveText(r.title, r.title_fi, locale) }));
  } catch (err) {
    console.error(`[/${locale}/menu/${categorySlug}] failed to load related categories:`, err);
  }

  const seoCopy = CATEGORY_SEO_COPY[categorySlug];
  const introText = seoCopy ? (locale === 'fi' ? seoCopy.fi : seoCopy.en) : null;

  const title = resolveText(category.title, category.title_fi, locale);
  // Schema.org Menu — a category-specific complement to the site-wide
  // Restaurant schema in app/(site)/[locale]/layout.tsx (which lists
  // servesCuisine generally); this ties the specific cuisine type to
  // this specific URL, which is what the Master SEO Plan's Phase 2
  // schema table calls for on the 3 hub pages.
  const menuSchema = seoCopy ? {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: title,
    inLanguage: locale,
    url: `https://ozy.fi/${locale}/menu/${categorySlug}`,
  } : null;

  // SEO gap-fill, Part A — Home > Category. This exact array feeds both
  // the visible trail (MenuPageClient -> Breadcrumbs) and the JSON-LD
  // below, so they can never describe two different things.
  const t = getDictionary(locale);
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t.breadcrumb.home, href: `/${locale}` },
    { label: title, href: `/${locale}/menu/${categorySlug}` },
  ];
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems, SITE_ORIGIN);

  return (
    <>
      {menuSchema && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(menuSchema) }} />
      )}
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <MenuPageClient
        onlyCategory={categorySlug}
        initialData={initialData}
        introText={introText}
        breadcrumbItems={breadcrumbItems}
        categoryTitle={title}
        relatedCategories={relatedCategories}
      />
    </>
  );
}
