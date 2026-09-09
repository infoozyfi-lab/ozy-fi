import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import ProductPageStandalone from '@/components/ProductPageStandalone';
import { loadMenuData } from '@/lib/menu-data';
import { resolveText, hreflangAlternates } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

async function getProduct(id) {
  const { env } = await getCloudflareContext({ async: true });
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND active = 1').bind(id).first();
  return row || null;
}

export async function generateMetadata({ params }) {
  const { locale, id } = params;
  const product = await getProduct(id);

  if (!product) {
    return { title: locale === 'fi' ? 'Tuote | ozy.fi' : 'Menu item | ozy.fi' };
  }

  const name = resolveText(product.name, product.name_fi, locale);
  const desc = resolveText(product.description, product.description_fi, locale);
  const title = `${name} — ozy.fi`;
  const description = desc || (locale === 'fi'
    ? `Tilaa ${name} verkosta kotiinkuljetuksena tai noutona ozy.fi:stä.`
    : `Order ${name} online for delivery or pickup from ozy.fi.`);

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/product/${id}`,
      languages: hreflangAlternates(`/product/${id}`),
    },
    openGraph: {
      title,
      description,
      url: `https://ozy.fi/${locale}/product/${id}`,
      locale: locale === 'fi' ? 'fi_FI' : 'en_US',
      type: 'website',
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }) {
  const { locale, id } = params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  const name = resolveText(product.name, product.name_fi, locale);
  const description = resolveText(product.description, product.description_fi, locale);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description || undefined,
    image: product.image || undefined,
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
      <ProductPageStandalone productId={id} productHint={{ ...product, name, description }} initialData={initialData} />
    </>
  );
}
