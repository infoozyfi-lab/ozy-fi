'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useTranslations } from '@/lib/i18n';

export default function PrivacyPageClient() {
  const t = useTranslations();

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>{t.privacy.title}</h1>
        <p className="legal-updated">{t.legal.lastUpdated(t.privacy.lastUpdated)}</p>

        <p>{t.privacy.intro}</p>

        <h2>{t.privacy.s1Title}</h2>
        <p>
          ozy.fi<br />
          {t.privacy.s1CompanyPlaceholder}<br />
          {t.privacy.s1AddressPlaceholder}<br />
          Email: hello@ozy.fi
        </p>

        <h2>{t.privacy.s2Title}</h2>
        <p>{t.privacy.s2Intro}</p>
        <ul>
          {t.privacy.s2Items.map((item: string) => <li key={item}>{item}</li>)}
        </ul>

        <h2>{t.privacy.s3Title}</h2>
        <ul>
          {t.privacy.s3Items.map((item: string) => <li key={item}>{item}</li>)}
        </ul>
        <p>{t.privacy.s3Outro}</p>

        <h2>{t.privacy.s4Title}</h2>
        <p>{t.privacy.s4Body}</p>

        <h2>{t.privacy.s5Title}</h2>
        <p>{t.privacy.s5Intro}</p>
        <ul>
          {t.privacy.s5Items.map((item: string) => <li key={item}>{item}</li>)}
        </ul>
        <p>{t.privacy.s5Outro}</p>

        <h2>{t.privacy.s6Title}</h2>
        <p>{t.privacy.s6Body}</p>

        <h2>{t.privacy.s7Title}</h2>
        <p>{t.privacy.s7Body}</p>
      </main>
      <Footer />
    </StoreProvider>
  );
}
