import ContactPageClient from '@/components/ContactPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';
import { getPublicSettings, parseOpeningHoursSetting, formatOpeningHoursRows } from '@/lib/site-settings';

// SEO gap-fill, Part C — see about/page.tsx for the shared pattern.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    title: t.contact.metaTitle,
    description: t.contact.intro,
    alternates: {
      canonical: `/${locale}/contact`,
      languages: hreflangAlternates('/contact'),
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const settings = await getPublicSettings();
  const hoursRows = formatOpeningHoursRows(parseOpeningHoursSetting(settings.opening_hours), t);

  return <ContactPageClient settings={settings} hoursRows={hoursRows} />;
}
