import TermsPageClient from '@/components/TermsPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    title: t.terms.metaTitle,
    description: t.terms.s1Body,
    alternates: {
      canonical: `/${locale}/terms`,
      languages: hreflangAlternates('/terms'),
    },
  };
}

export default function TermsPage() {
  return <TermsPageClient />;
}
