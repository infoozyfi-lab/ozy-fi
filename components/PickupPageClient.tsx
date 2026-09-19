'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PublicSettingsInfo, { type HoursRow } from '@/components/PublicSettingsInfo';
import { useTranslations } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/site-settings';

// SEO gap-fill, Part C — see AboutPageClient.tsx for the shared pattern.
// `orderingPlaceholder` below exists because this codebase's checkout
// flow (components/CheckoutModal.tsx, app/api/orders/route.ts) only ever
// collects a delivery address today — there's no pickup toggle or order
// type anywhere in the schema/API, even though marketing copy elsewhere
// on the site ("delivery or pickup at checkout") already implies one
// exists. Flagged plainly here and in this feature's delivery report
// rather than asserting a pickup flow that isn't actually there.
export default function PickupPageClient({
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
        <h1>{t.pickup.title}</h1>
        <p>{t.pickup.intro}</p>

        <PublicSettingsInfo
          settings={settings}
          hoursRows={hoursRows}
          t={t}
          headings={{ address: t.pickup.locationHeading, hours: t.pickup.hoursHeading }}
        />

        <div className="placeholder-block">
          <span className="placeholder-eyebrow">{t.common.placeholderLabel}</span>
          <p>{t.pickup.orderingPlaceholder}</p>
        </div>
      </main>
      <Footer />
    </StoreProvider>
  );
}
