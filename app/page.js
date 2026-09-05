'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Story from '@/components/Story';
import MenuSection from '@/components/MenuSection';
import Visit from '@/components/Visit';
import CtaStrip from '@/components/CtaStrip';
import Footer from '@/components/Footer';
import ProductPage from '@/components/ProductPage';
import CartDrawer from '@/components/CartDrawer';
import CheckoutModal from '@/components/CheckoutModal';
import ConfirmModal from '@/components/ConfirmModal';
import OrderBar from '@/components/OrderBar';

export default function Home() {
  return (
    <StoreProvider>
      <div id="top" />
      <Header />
      <Hero />
      <Story />
      <MenuSection />
      <Visit />
      <CtaStrip />
      <Footer />

      <ProductPage />
      <CartDrawer />
      <CheckoutModal />
      <ConfirmModal />
      <OrderBar />
    </StoreProvider>
  );
}
