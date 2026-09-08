import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import ProductPageStandalone from '@/components/ProductPageStandalone';

export const dynamic = 'force-dynamic';

async function getProduct(id) {
  const { env } = await getCloudflareContext({ async: true });
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND active = 1').bind(id).first();
  return row || null;
}

export async function generateMetadata({ params }) {
  const product = await getProduct(params.id);

  if (!product) {
    return { title: 'Menu item | ozy.fi' };
  }

  return {
    title: `${product.name} — ozy.fi`,
    description: product.description || `Order ${product.name} online for delivery or pickup from ozy.fi.`,
    alternates: {
      canonical: `/product/${params.id}`,
    },
    openGraph: {
      title: `${product.name} — ozy.fi`,
      description: product.description || undefined,
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }) {
  const product = await getProduct(params.id);

  if (!product) {
    notFound();
  }

  return <ProductPageStandalone productId={params.id} />;
}
