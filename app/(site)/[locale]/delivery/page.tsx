import DeliveryPageClient from '@/components/DeliveryPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';
import { getPublicSettings } from '@/lib/site-settings';

// SEO gap-fill, Part C — see about/page.tsx for the shared pattern. No
// opening-hours fetch here (unlike about/contact/pickup) — the delivery
// page shows fee/minimum-order/postal-zone data, not location hours.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    title: t.delivery.metaTitle,
    description: t.delivery.intro,
    alternates: {
      canonical: `/${locale}/delivery`,
      languages: hreflangAlternates('/delivery'),
    },
  };
}

export default async function DeliveryPage() {
  const settings = await getPublicSettings();
  return <DeliveryPageClient settings={settings} />;
}
