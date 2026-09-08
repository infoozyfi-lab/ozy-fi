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

function AutoOpenProduct({ productId }) {
  const { products, menuLoading, openProduct, activeProduct } = useStore();

  useEffect(() => {
    if (menuLoading || activeProduct) return;
    const product = products.find((p) => p.id === productId);
    if (product) openProduct(product);
  }, [menuLoading, products, activeProduct, productId, openProduct]);

  if (!menuLoading && !products.find((p) => p.id === productId)) {
    return (
      <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p>This item isn&apos;t available right now.</p>
      </div>
    );
  }

  return null;
}

export default function ProductPageStandalone({ productId }) {
  return (
    <StoreProvider>
      <div id="top" />
      <Header />
      <AutoOpenProduct productId={productId} />
      <Footer />

      <ProductPage />
      <DrinkUpsellModal />
      <CheckoutModal />
      <ConfirmModal />
      <OrderBar />
    </StoreProvider>
  );
}
