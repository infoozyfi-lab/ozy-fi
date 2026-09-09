import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import ProductPageStandalone from '@/components/ProductPageStandalone';
import { loadMenuData } from '@/lib/menu-data';

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

  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: product.image || undefined,
    offers: {
      '@type': 'Offer',
      price: Number(product.offer_price || product.price).toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: `https://ozy.fi/product/${params.id}`,
    },
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <ProductPageStandalone productId={params.id} productHint={product} initialData={initialData} />
    </>
  );
}
