'use client';

import { useEffect } from 'react';
import { StoreProvider, useStore } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductPage from '@/components/ProductPage';
import DrinkUpsellModal from '@/components/DrinkUpsellModal';
import CheckoutModal from '@/components/CheckoutModal';
import ConfirmModal from '@/components/ConfirmModal';
import OrderBar from '@/components/OrderBar';

// Shown the instant the page loads, using the product row the server
// already fetched (for the <title>/meta tags) — so the customer sees the
// real photo/name/price immediately instead of a blank page while the
// full menu (needed for the topping picker) loads in the background.
function ProductSkeleton({ productHint }) {
  if (!productHint) {
    return <div className="wrap" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }
  return (
    <div className="wrap" style={{ padding: '24px 0 60px', maxWidth: 480 }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 18 }}>
        <img src={productHint.image} alt={productHint.name} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem' }}>{productHint.name}</h1>
      {productHint.description && <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>{productHint.description}</p>}
      <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--ember)' }}>{Number(productHint.price).toFixed(2)} €</p>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 18 }}>Loading options…</p>
    </div>
  );
}

function AutoOpenProduct({ productId, productHint }) {
  const { products, menuLoading, openProduct, activeProduct } = useStore();

  useEffect(() => {
    if (menuLoading || activeProduct) return;
    const product = products.find((p) => p.id === productId);
    if (product) openProduct(product, null, { skipUrlPush: true });
  }, [menuLoading, products, activeProduct, productId, openProduct]);

  if (menuLoading) {
    return <ProductSkeleton productHint={productHint} />;
  }

  if (!products.find((p) => p.id === productId)) {
    return (
      <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p>This item isn&apos;t available right now.</p>
      </div>
    );
  }

  return null;
}

export default function ProductPageStandalone({ productId, productHint }) {
  return (
    <StoreProvider>
      <div id="top" />
      <Header />
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
