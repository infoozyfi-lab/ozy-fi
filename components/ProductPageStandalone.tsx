'use client';

import { useEffect } from 'react';
import { StoreProvider, useStore, type StoreProviderInitialData } from '@/context/StoreContext';
import Header from '@/components/Header';
import Breadcrumbs, { type BreadcrumbItem } from '@/components/Breadcrumbs';
import Footer from '@/components/Footer';
import ProductPage from '@/components/ProductPage';
import DrinkUpsellModal from '@/components/DrinkUpsellModal';
import CheckoutModal from '@/components/CheckoutModal';
import ConfirmModal from '@/components/ConfirmModal';
import OrderBar from '@/components/OrderBar';
import { useTranslations } from '@/lib/i18n';
import type { RawProduct } from '@/lib/types';

// Shown the instant the page loads, using the product row the server
// already fetched (for the <title>/meta tags) — so the customer sees the
// real photo/name/price immediately instead of a blank page while the
// full menu (needed for the topping picker) loads in the background.
function ProductSkeleton({ productHint, t }: { productHint?: RawProduct | null; t: any }) {
  if (!productHint) {
    return <div className="wrap" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>{t.common.loading}</div>;
  }
  return (
    <div className="wrap" style={{ padding: '24px 0 60px', maxWidth: 480 }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 18 }}>
        <img src={productHint.image ?? undefined} alt={productHint.name} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem' }}>{productHint.name}</h1>
      {productHint.description && <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>{productHint.description}</p>}
      <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--ember)' }}>{Number(productHint.price).toFixed(2)} €</p>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 18 }}>{t.productPage.loadingOptions}</p>
    </div>
  );
}

function AutoOpenProduct({ productId, productHint }: { productId: string; productHint?: RawProduct | null }) {
  // Size-selector-not-showing bug report — confirmed root cause (traced
  // and reproduced with real code execution, see
  // worker/test-data/size-not-showing-verify.js): this effect used to gate
  // on `menuLoading`, which is `false` from the very first render whenever
  // the Server Component already seeded `initialData` — true for every
  // standalone /product/[id] visit. That made this effect call
  // openProduct() immediately, using `products` as seeded by
  // normalizeProducts() (lib/menu-i18n.ts's lighter SSR-seed function,
  // which never attaches `sizeOptions` at all — only the full
  // normalizeMenuBlob() output from this store's own `/api/menu` fetch
  // does). Once that premature call set `activeProduct`, THIS SAME
  // effect's own guard (`... || activeProduct`) permanently skipped every
  // later run — so when the real fetch resolved moments later with the
  // product's actual size tiers, nothing ever re-opened the product to
  // pick them up. `selection.sizeOptions` stayed pinned to the single
  // FALLBACK_OPTION entry for the rest of that page load, which is
  // exactly why ProductPage.tsx's `hasRealSizeTiers` check (and every
  // rendering style before it) never showed a size selector at all.
  //
  // `menuFullyLoaded` (context/StoreContext.tsx) is the fix: unlike
  // `menuLoading`, it always starts `false` and only becomes `true` once
  // the REAL `/api/menu` fetch has actually settled — so this effect (and
  // the loading-skeleton render below) now correctly wait for the
  // complete, per-product data before ever calling openProduct(), instead
  // of mistaking "SSR seeded a partial product list" for "ready."
  const { products, menuFullyLoaded, openProduct, activeProduct } = useStore();
  const t = useTranslations();

  useEffect(() => {
    if (!menuFullyLoaded || activeProduct) return;
    const product = products.find((p) => p.id === productId);
    if (product) openProduct(product, null, { skipUrlPush: true });
  }, [menuFullyLoaded, products, activeProduct, productId, openProduct]);

  if (!menuFullyLoaded) {
    return <ProductSkeleton productHint={productHint} t={t} />;
  }

  if (!products.find((p) => p.id === productId)) {
    return (
      <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p>{t.productPage.itemUnavailable}</p>
      </div>
    );
  }

  return null;
}

export default function ProductPageStandalone({
  productId,
  productHint,
  initialData,
  breadcrumbItems,
}: {
  productId: string;
  productHint?: RawProduct | null;
  initialData?: StoreProviderInitialData | null;
  // SEO gap-fill, Part A — Home > Category > Product, built server-side
  // (app/(site)/[locale]/product/[id]/page.tsx) from the same product +
  // category data used for generateMetadata, so the trail is always
  // consistent with the actual page.
  breadcrumbItems?: BreadcrumbItem[];
}) {
  return (
    <StoreProvider initialData={initialData}>
      <div id="top" />
      <Header />
      <Breadcrumbs items={breadcrumbItems} />
      <AutoOpenProduct productId={productId} productHint={productHint} />
      <Footer />

      <ProductPage />
      <DrinkUpsellModal />
      <CheckoutModal />
      <ConfirmModal />
      <OrderBar />
    </StoreProvider>
  );
}
