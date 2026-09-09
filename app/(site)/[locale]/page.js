import { getCloudflareContext } from '@opennextjs/cloudflare';
import HomePageClient from '@/components/HomePageClient';
import { loadMenuData } from '@/lib/menu-data';
import { hreflangAlternates } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

// Bilingual site — same real title/description per language a search
// engine actually needs, not the English copy reused. `alternates.canonical`
// points at THIS locale's own URL and `alternates.languages` lists both,
// which is what tells Google these two URLs are translations of each
// other rather than duplicate content.
export function generateMetadata({ params }) {
  const { locale } = params;
  const title = locale === 'fi'
    ? 'ozy.fi — Pizzaa, kebabia ja hampurilaisia | Kotiinkuljetus ja nouto'
    : 'ozy.fi — Pizza, Kebab & Burgers | Delivery & Pickup';
  const description = locale === 'fi'
    ? 'Tilaa tuoretta pizzaa, kebabia tai hampurilaisia verkosta — kotiinkuljetus tai nouto. Valmistetaan tilauksesta, aina kuumana.'
    : 'Order fresh pizza, kebab or burgers online — delivery or pickup. Made to order, always hot.';

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: hreflangAlternates(''),
    },
    openGraph: {
      title,
      description,
      url: `https://ozy.fi/${locale}`,
      locale: locale === 'fi' ? 'fi_FI' : 'en_US',
      type: 'website',
    },
  };
}

export default async function Home({ params }) {
  const { env } = await getCloudflareContext({ async: true });
  const initialData = await loadMenuData(env);

  return <HomePageClient initialData={initialData} />;
}
