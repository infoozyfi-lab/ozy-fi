'use client';

import Link from 'next/link';
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
import { useTranslations, useLocalePath } from '@/lib/i18n';

export default function MenuPageClient({
  onlyCategory = null,
  initialData = null,
  introText = null,
  breadcrumbItems,
  categoryTitle = null,
  relatedCategories = [],
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
  // Round-2 fixes brief, Part 2 — the category's own real, bilingual
  // title (already resolved server-side — see app/(site)/[locale]/menu/
  // [category]/page.tsx's `title`), rendered here as the page's real
  // <h1>. Only passed by that same category page; stays null for the
  // plain /menu page (MenuSection itself supplies that page's one <h1>,
  // "Full menu" — see this component's own MenuSection call below) and is
  // never used at all by the homepage (which imports MenuSection
  // directly, not through this component).
  categoryTitle?: string | null;
  // Round-2 fixes brief, Part 3 — real, data-driven cross-links to other
  // categories that genuinely share tagged items with this one (computed
  // server-side — see app/(site)/[locale]/menu/[category]/page.tsx's
  // getRelatedCategories). Always [] for the plain /menu page and the
  // homepage, same as categoryTitle/introText above.
  relatedCategories?: { id: string; title: string }[];
}) {
  const t = useTranslations();
  const lp = useLocalePath();
  return (
    <StoreProvider initialData={initialData}>
      <div id="top" />
      <Header />
      <Breadcrumbs items={breadcrumbItems} />
      {/* Round-2 fixes brief, Part 2 — genuinely distinct per category
          (real title text, not this generic component's own heading),
          and the only <h1> on this page when present. */}
      {categoryTitle && (
        <h1 style={{ maxWidth: 720, margin: '24px auto 0', padding: '0 20px', textAlign: 'center' }}>
          {categoryTitle}
        </h1>
      )}
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
      <MenuSection onlyCategory={onlyCategory} hideHeading={Boolean(categoryTitle)} headingTag="h1" />

      {/* Round-2 fixes brief, Part 3 — real cross-category links, only
          rendered when a genuine overlap was actually found (see this
          component's own relatedCategories comment); never a forced/
          invented relationship. */}
      {relatedCategories.length > 0 && (
        <div className="wrap" style={{ padding: '0 20px 32px', textAlign: 'center' }}>
          <p className="pp-label" style={{ margin: '0 0 10px' }}>{t.menuSection.relatedCategoriesHeading}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {relatedCategories.map((cat) => (
              <Link key={cat.id} href={lp(`/menu/${cat.id}`)} className="cat-tab">
                {cat.title}
              </Link>
            ))}
          </div>
        </div>
      )}

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
