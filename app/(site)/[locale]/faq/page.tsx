import FaqPageClient from '@/components/FaqPageClient';
import { getDictionary, hreflangAlternates } from '@/lib/i18n/locales';

export function generateMetadata({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  const t = getDictionary(locale);
  return {
    title: t.faq.metaTitle,
    description: t.faq.intro,
    alternates: {
      canonical: '/' + locale + '/faq',
      languages: hreflangAlternates('/faq'),
    },
  };
}

export default function FaqPage({ params }: { params: { locale: string } }) {
  const t = getDictionary(params.locale);
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map(function (item: { q: string; a: string }) {
      return {
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      };
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FaqPageClient />
    </>
  );
}
