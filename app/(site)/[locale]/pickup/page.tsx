import PickupPageClient from '@/components/PickupPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';
import { getPublicSettings, parseOpeningHoursSetting, formatOpeningHoursRows } from '@/lib/site-settings';

// SEO gap-fill, Part C — see about/page.tsx for the shared pattern.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    title: t.pickup.metaTitle,
    description: t.pickup.intro,
    alternates: {
      canonical: `/${locale}/pickup`,
      languages: hreflangAlternates('/pickup'),
    },
  };
}

export default async function PickupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const settings = await getPublicSettings();
  const hoursRows = formatOpeningHoursRows(parseOpeningHoursSetting(settings.opening_hours), t);

  return <PickupPageClient settings={settings} hoursRows={hoursRows} />;
}
