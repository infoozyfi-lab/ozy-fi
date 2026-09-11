'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import type { Bundle, Featured, Product } from '@/lib/types';

interface RenderCardArgs {
  products: Product[];
  bundles: Bundle[];
  openBundle: (bundle: Bundle) => void;
  t: any;
  lp: (path: string) => string;
}

export default function FeaturedCard() {
  const { featured, products, bundles, openBundle } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();

  if (!featured || featured.type === 'none') return null;

  return <section className="featured-section"><div className="wrap">{renderCard(featured, { products, bundles, openBundle, t, lp })}</div></section>;
}

function renderCard(featured: Featured, { products, bundles, openBundle, t, lp }: RenderCardArgs) {
  if (featured.type === 'product') {
    const product = products.find((p) => p.id === featured.productId);
    if (!product) return null;
    return (
      <Link href={lp(`/product/${product.id}`)} className="featured-card">
        <span className="featured-badge">{t.featuredCard.badgeNew}</span>
        <img className="featured-img" src={product.image ?? undefined} alt={product.name} />
        <span className="featured-info">
          <span className="featured-name">{product.name}</span>
          {/* Same reasoning as PopularNow.tsx — price is typed optional but always
              populated for a real product; non-null assertion is a no-op fix under
              strict mode (still throws if ever actually missing, same as before). */}
          <span className="featured-price">{product.price!.toFixed(2)} €</span>
        </span>
      </Link>
    );
  }

  if (featured.type === 'bundle') {
    const bundle = bundles.find((b) => b.id === featured.bundleId);
    if (!bundle) return null;
    return (
      <button type="button" className="featured-card" onClick={() => openBundle(bundle)}>
        <span className="featured-badge">{t.featuredCard.badgeDeal}</span>
        <img className="featured-img" src={bundle.image ?? undefined} alt={bundle.title} />
        <span className="featured-info">
          <span className="featured-name">{bundle.title}</span>
          <span className="featured-price">{bundle.price.toFixed(2)} €</span>
        </span>
      </button>
    );
  }

  if (featured.type === 'banner') {
    if (!featured.bannerImage && !featured.bannerTitle) return null;
    const goToMenu = () => {
      document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
      <button type="button" className="featured-card" onClick={goToMenu}>
        <span className="featured-badge">{t.featuredCard.badgeNew}</span>
        {featured.bannerImage && <img className="featured-img" src={featured.bannerImage} alt={featured.bannerTitle} />}
        <span className="featured-info">
          <span className="featured-name">{featured.bannerTitle}</span>
          {featured.bannerPrice && <span className="featured-price">{featured.bannerPrice}</span>}
        </span>
      </button>
    );
  }

  return null;
}
