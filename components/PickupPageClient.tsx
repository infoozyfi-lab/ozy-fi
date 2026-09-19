'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PublicSettingsInfo, { type HoursRow } from '@/components/PublicSettingsInfo';
import { useTranslations } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/site-settings';

// Round-2 fixes brief, Part 5 — this page used to show an honest
// placeholder here (see AboutPageClient.tsx for that shared pattern)
// because checkout only ever collected a delivery address, with no
// pickup option anywhere in the schema/API — see
// FULL-SITE-AUDIT-ROUND2-REPORT.md. Now that CheckoutModal.tsx has a real
// delivery/pickup toggle (step 2) and app/api/orders/route.ts actually
// supports pickup orders end to end, this shows real instructions
// instead.
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

        <h2>{t.pickup.orderingHeading}</h2>
        <p>{t.pickup.orderingInstructions}</p>
      </main>
      <Footer />
    </StoreProvider>
  );
}
