'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useTranslations } from '@/lib/i18n';

export default function TermsPageClient() {
  const t = useTranslations();

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>{t.terms.title}</h1>
        <p className="legal-updated">{t.legal.lastUpdated(t.terms.lastUpdated)}</p>

        <h2>{t.terms.s1Title}</h2>
        <p>{t.terms.s1Body}</p>

        <h2>{t.terms.s2Title}</h2>
        <p>{t.terms.s2Body}</p>

        <h2>{t.terms.s3Title}</h2>
        <p>{t.terms.s3Body}</p>

        <h2>{t.terms.s4Title}</h2>
        <p>{t.terms.s4Body}</p>

        <h2>{t.terms.s5Title}</h2>
        <p>{t.terms.s5Body}</p>

        <h2>{t.terms.s6Title}</h2>
        <p>{t.terms.s6Body}</p>

        <h2>{t.terms.s7Title}</h2>
        <p>{t.terms.s7Body}</p>
      </main>
      <Footer />
    </StoreProvider>
  );
}
