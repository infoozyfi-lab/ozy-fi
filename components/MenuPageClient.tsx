'use client';

import { StoreProvider, type StoreProviderInitialData } from '@/context/StoreContext';
import Header from '@/components/Header';
import Breadcrumbs, { type BreadcrumbItem } from '@/components/Breadcrumbs';
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
  introText = null,
  breadcrumbItems,
}: {
  onlyCategory?: string | null;
  initialData?: StoreProviderInitialData | null;
  // SEO/GEO "direct answer" intro — a short (40-60 word) paragraph shown
  // above the product grid on a single-category page (e.g. /menu/pizzat),
  // server-rendered so both Google and AI answer engines see real,
  // on-page text rather than just the <head> description. Only passed on
  // category-specific pages (see app/(site)/[locale]/menu/[category]/
  // page.tsx) — the full /menu page has no single-category "answer" to
  // give, so it stays null there.
  introText?: string | null;
  // SEO gap-fill, Part A — same idea: only passed by the single-category
  // page (Home > Category), never by the full /menu listing, which has no
  // specific category to show a trail for.
  breadcrumbItems?: BreadcrumbItem[];
}) {
  return (
    <StoreProvider initialData={initialData}>
      <div id="top" />
      <Header />
      <Breadcrumbs items={breadcrumbItems} />
      {introText && (
        <p
          style={{
            maxWidth: 720, margin: '24px auto 0', padding: '0 20px',
            fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--muted, #756B5F)', textAlign: 'center',
          }}
        >
          {introText}
        </p>
      )}
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
