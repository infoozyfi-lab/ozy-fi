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
  const category = await getCategory(params.category);

  if (!category) {
    notFound();
  }

  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  return <MenuPageClient onlyCategory={params.category} initialData={initialData} />;
}
