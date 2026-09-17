import PrivacyPageClient from '@/components/PrivacyPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    title: t.privacy.metaTitle,
    description: t.privacy.intro,
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: hreflangAlternates('/privacy'),
    },
  };
}

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
