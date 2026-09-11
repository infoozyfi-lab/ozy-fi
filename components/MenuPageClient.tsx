'use client';

import { StoreProvider, type StoreProviderInitialData } from '@/context/StoreContext';
import Header from '@/components/Header';
import MenuSection from '@/components/MenuSection';
import Footer from '@/components/Footer';
import ProductPage from '@/components/ProductPage';
import BundleModal from '@/components/BundleModal';
import DrinkUpsellModal from '@/components/DrinkUpsellModal';
import CheckoutModal from '@/components/CheckoutModal';
import ConfirmModal from '@/components/ConfirmModal';
import OrderBar from '@/components/OrderBar';

export default function MenuPageClient({
  onlyCategory = null,
  initialData = null,
}: {
  onlyCategory?: string | null;
  initialData?: StoreProviderInitialData | null;
}) {
  return (
    <StoreProvider initialData={initialData}>
      <div id="top" />
      <Header />
      <MenuSection onlyCategory={onlyCategory} />
      <Footer />

      <ProductPage />
      <BundleModal />
      <DrinkUpsellModal />
      <CheckoutModal />
      <ConfirmModal />
      <OrderBar />
    </StoreProvider>
  );
}
