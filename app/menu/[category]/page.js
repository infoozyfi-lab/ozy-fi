import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import MenuPageClient from '@/components/MenuPageClient';

export const dynamic = 'force-dynamic';

async function getCategory(slug) {
  const { env } = await getCloudflareContext({ async: true });
  const row = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(slug).first();
  return row || null;
}

export async function generateMetadata({ params }) {
  const category = await getCategory(params.category);

  if (!category) {
    return { title: 'Menu | ozy.fi' };
  }

  return {
    title: `${category.title} Menu — ozy.fi`,
    description: category.sub || `Browse our ${category.title} menu and order online for delivery or pickup.`,
    alternates: {
      canonical: `/menu/${params.category}`,
    },
  };
}

export default async function CategoryMenuPage({ params }) {
  const category = await getCategory(params.category);

  if (!category) {
    notFound();
  }

  return <MenuPageClient onlyCategory={params.category} />;
}
