'use client';

import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useTranslations } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/site-settings';

// Formats a raw admin_settings numeric string (e.g. "2.5") as "2.50 €",
// same convention as every other price display in this codebase (see
// e.g. components/admin/ResourceManager.tsx's `€${Number(...).toFixed(2)}`).
// Empty/unset/non-numeric -> null, so the caller can show t.visit.notSet.
function formatEuro(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : null;
}

// SEO gap-fill, Part C — see AboutPageClient.tsx for the shared pattern.
// The delivery area itself is never independently described here: it's
// always derived straight from admin_settings.delivery_postal_codes, the
// exact same setting app/api/orders/route.ts checks a real order against
// at checkout — this page can't drift out of sync with what checkout
// actually enforces, because it reads the same value.
export default function DeliveryPageClient({ settings }: { settings: PublicSettings }) {
  const t = useTranslations();

  const fee = formatEuro(settings.delivery_fee);
  const minOrder = formatEuro(settings.minimum_order);

  // Same split/trim/filter as the zone list app/api/orders/route.ts
  // builds from this exact setting — see that file's comment for what a
  // short (<=3 char) entry vs. a full postal code each mean.
  const zones = String(settings.delivery_postal_codes || '')
    .split(',')
    .map((z) => z.trim())
    .filter(Boolean);

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>{t.delivery.title}</h1>
        <p>{t.delivery.intro}</p>

        <div className="visit-block">
          <h3>{t.delivery.feeLabel}</h3>
          <p>{fee || t.visit.notSet}</p>

          <h3>{t.delivery.minOrderLabel}</h3>
          <p>{minOrder || t.visit.notSet}</p>

          <h3>{t.delivery.areaHeading}</h3>
          {zones.length > 0 ? (
            <>
              <p>{t.delivery.areaConfiguredIntro}</p>
              <p style={{ fontWeight: 700 }}>{zones.join(', ')}</p>
            </>
          ) : (
            <p>{t.delivery.areaUnset}</p>
          )}
        </div>
      </main>
      <Footer />
    </StoreProvider>
  );
}
