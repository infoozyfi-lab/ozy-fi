'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PublicSettingsInfo, { type HoursRow } from '@/components/PublicSettingsInfo';
import { useTranslations } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/site-settings';

// SEO gap-fill, Part C — same shape as PrivacyPageClient.tsx/
// TermsPageClient.tsx (StoreProvider -> Header -> <main class="wrap
// legal-page"> -> Footer), the established pattern for a static,
// informational page under app/(site)/[locale]. `settings`/`hoursRows`
// are fetched server-side (app/(site)/[locale]/about/page.tsx via
// lib/site-settings.ts) and passed down as plain serializable props,
// same as productHint on ProductPageStandalone.
export default function AboutPageClient({
  settings,
  hoursRows,
}: {
  settings: PublicSettings;
  hoursRows: HoursRow[];
}) {
  const t = useTranslations();

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>{t.about.title}</h1>
        <p>{t.footer.tagline}</p>

        <h2>{t.about.storyHeading}</h2>
        <div className="placeholder-block">
          <span className="placeholder-eyebrow">{t.common.placeholderLabel}</span>
          <p>{t.about.storyPlaceholder}</p>
        </div>

        <h2>{t.about.findUsHeading}</h2>
        <PublicSettingsInfo settings={settings} hoursRows={hoursRows} t={t} />
      </main>
      <Footer />
    </StoreProvider>
  );
}
