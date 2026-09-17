import { getCloudflareContext } from '@opennextjs/cloudflare';
import HomePageClient from '@/components/HomePageClient';
import { loadMenuData } from '@/lib/menu-data';
import { hreflangAlternates } from '@/lib/i18n/locales';
import type { StoreProviderInitialData } from '@/context/StoreContext';

export const dynamic = 'force-dynamic';

// Bilingual site — same real title/description per language a search
// engine actually needs, not the English copy reused. `alternates.canonical`
// points at THIS locale's own URL and `alternates.languages` lists both,
// which is what tells Google these two URLs are translations of each
// other rather than duplicate content.
export function generateMetadata({ params }: { params: { locale: string } }) {
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

export default async function Home({ params }: { params: { locale: string } }) {
  // Bug-fix (bilingual-site crash, Sept 2026): this D1/Cloudflare-context
  // call used to be unguarded. It's the one call in this render path that
  // talks to live infrastructure rather than local logic, and it now runs
  // right after middleware.js (new this deploy) touches every request —
  // if that combination ever misbehaves post-deploy in a way local
  // `next dev` can't reproduce, this used to throw uncaught and take down
  // the whole page (see app/(site)/[locale]/error.js's comment for what
  // "uncaught" meant before this fix existed). Falling back to
  // initialData=null instead means the page still renders — the customer
  // just gets the client-side /api/menu fetch (context/StoreContext.js
  // already handles initialData being absent) instead of pre-seeded SSR
  // content for that one request.
  let initialData: StoreProviderInitialData | null = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    initialData = await loadMenuData(env);
  } catch (err) {
    console.error(`[/${params?.locale}] Home: failed to load SSR menu data:`, err);
  }

  return <HomePageClient initialData={initialData} />;
}
