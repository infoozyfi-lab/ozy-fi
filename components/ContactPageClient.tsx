'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PublicSettingsInfo, { type HoursRow } from '@/components/PublicSettingsInfo';
import { useTranslations } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/site-settings';

// SEO gap-fill, Part C — see AboutPageClient.tsx for the shared pattern
// this follows.
export default function ContactPageClient({
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
        <h1>{t.contact.title}</h1>
        <p>{t.contact.intro}</p>
        <PublicSettingsInfo settings={settings} hoursRows={hoursRows} t={t} />
      </main>
      <Footer />
    </StoreProvider>
  );
}
