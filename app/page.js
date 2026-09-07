'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import FeaturedCard from '@/components/FeaturedCard';
import Story from '@/components/Story';
import Bundles from '@/components/Bundles';
import MenuSection from '@/components/MenuSection';
import Visit from '@/components/Visit';
import CtaStrip from '@/components/CtaStrip';
import Footer from '@/components/Footer';
import ProductPage from '@/components/ProductPage';
import BundleModal from '@/components/BundleModal';
import DrinkUpsellModal from '@/components/DrinkUpsellModal';
import CheckoutModal from '@/components/CheckoutModal';
import ConfirmModal from '@/components/ConfirmModal';
import OrderBar from '@/components/OrderBar';

export default function Home() {
  return (
    <StoreProvider>
      <div id="top" />
      <Header />
      <Hero />
      <FeaturedCard />
      <Story />
      <Bundles />
      <MenuSection />
      <Visit />
      <CtaStrip />
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
