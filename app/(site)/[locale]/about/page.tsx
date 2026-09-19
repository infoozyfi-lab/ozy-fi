import AboutPageClient from '@/components/AboutPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';
import { getPublicSettings, parseOpeningHoursSetting, formatOpeningHoursRows } from '@/lib/site-settings';

// SEO gap-fill, Part C — same thin-Server-Component-wrapper shape as
// app/(site)/[locale]/faq/page.tsx / privacy/page.tsx / terms/page.tsx:
// generateMetadata here (needs a Server Component), the actual markup in
// a 'use client' *PageClient.tsx (Header/cart need StoreContext).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    title: t.about.metaTitle,
    description: t.footer.tagline,
    alternates: {
      canonical: `/${locale}/about`,
      languages: hreflangAlternates('/about'),
    },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const settings = await getPublicSettings();
  const hoursRows = formatOpeningHoursRows(parseOpeningHoursSetting(settings.opening_hours), t);

  return <AboutPageClient settings={settings} hoursRows={hoursRows} />;
}
