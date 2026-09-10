import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import MenuPageClient from '@/components/MenuPageClient';
import { loadMenuData } from '@/lib/menu-data';
import { resolveText, hreflangAlternates } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

async function getCategory(slug) {
  const { env } = await getCloudflareContext({ async: true });
  const row = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(slug).first();
  return row || null;
}

export async function generateMetadata({ params }) {
  const { locale, category: categorySlug } = params;
  const category = await getCategory(categorySlug);

  if (!category) {
    return { title: locale === 'fi' ? 'Ruokalista | ozy.fi' : 'Menu | ozy.fi' };
  }

  const title = resolveText(category.title, category.title_fi, locale);
  const sub = resolveText(category.sub, category.sub_fi, locale);
  const pageTitle = locale === 'fi' ? `${title} — Ruokalista | ozy.fi` : `${title} Menu — ozy.fi`;
  const description = sub || (locale === 'fi'
    ? `Selaa ${title}-valikoimaamme ja tilaa verkosta kotiinkuljetuksena tai noutona.`
    : `Browse our ${title} menu and order online for delivery or pickup.`);

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: `/${locale}/menu/${categorySlug}`,
      languages: hreflangAlternates(`/menu/${categorySlug}`),
    },
    openGraph: { title: pageTitle, description, url: `https://ozy.fi/${locale}/menu/${categorySlug}`, locale: locale === 'fi' ? 'fi_FI' : 'en_US', type: 'website' },
  };
}

export default async function CategoryMenuPage({ params }) {
  // Not wrapped in try/catch: if getCategory() itself throws (a real D1
  // failure), we deliberately let that propagate to
  // app/(site)/[locale]/error.js rather than swallow it and call
  // notFound() — a database error is not the same thing as "this category
  // genuinely doesn't exist", and treating it as a 404 would hide a real
  // problem behind a misleading "not found" page (bug-fix, bilingual-site
  // crash, Sept 2026 — see error.js's comment for why that boundary now
  // exists to catch this safely instead of it reaching global-error.js).
  const category = await getCategory(params.category);

  if (!category) {
    notFound();
  }

  // This second D1 call (the full menu blob, for SSR-seeding the page)
  // gets the same defensive fallback as the other page.js files — see
  // app/(site)/[locale]/page.js for the full reasoning.
  let initialData = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    initialData = await loadMenuData(env);
  } catch (err) {
    console.error(`[/${params?.locale}/menu/${params?.category}] failed to load SSR menu data:`, err);
  }

  return <MenuPageClient onlyCategory={params.category} initialData={initialData} />;
}
