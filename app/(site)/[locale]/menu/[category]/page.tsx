import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';
import MenuPageClient from '@/components/MenuPageClient';
import { loadMenuData } from '@/lib/menu-data';
import { resolveText, hreflangAlternates } from '@/lib/i18n/locales';
import type { StoreProviderInitialData } from '@/context/StoreContext';
import type { RawCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

// SEO/GEO "direct answer" intros — short (40-60 word), keyword-natural
// paragraphs for the 3 main category hub pages (per the SEO Master Plan's
// Phase 4: "GEO Answer Blocks" — this is the piece meant to be the "easy
// quote" an AI answer engine like ChatGPT/Perplexity can lift directly).
// Keyed by the actual category id used in the database (see
// worker/seed.sql) — deliberately only the 3 hub categories the plan
// calls out; any other category (e.g. voner, kanakebab) simply gets no
// intro (introText stays null), same as before this change, rather than
// guessing at copy for categories the plan didn't ask for.
const CATEGORY_SEO_COPY: Record<string, { fi: string; en: string }> = {
  pizzat: {
    fi: 'ozy.fi tarjoaa tuoreet, uunista suoraan tulevat pizzat Helsingissä — klassinen tomaattipohja, runsaasti täytevaihtoehtoja ja nopea kotiinkuljetus tai nouto. Tilaa verkossa ja valitse haluamasi koko, pohja ja täytteet muutamalla klikkauksella.',
    en: 'ozy.fi serves fresh, oven-baked pizza in Helsinki — a classic tomato base, a wide choice of toppings, and fast delivery or pickup. Order online and customize your size, base, and toppings in just a few taps.',
  },
  kebab: {
    fi: 'ozy.fi:n kebab valmistetaan tuoreista raaka-aineista ja tarjoillaan runsaalla täytteellä — salaatti, tomaatti, chili ja valitsemasi kastike. Tilaa kotiinkuljetuksena tai noutona Helsingissä, valmis muutamassa minuutissa.',
    en: "ozy.fi's kebab is made with fresh ingredients and served fully loaded — lettuce, tomato, chili, and your choice of sauce. Order for delivery or pickup in Helsinki, ready in minutes.",
  },
  burgerit: {
    fi: 'ozy.fi:n burgerit valmistetaan tuoreista raaka-aineista mehukkaalla pihvillä, salaatilla, tomaatilla ja burgerikastikkeella. Ateriaan sisältyy aina ranskalaiset ja juoma. Tilaa kotiinkuljetuksena tai noutona Helsingissä.',
    en: "ozy.fi's burgers are made fresh with a juicy patty, lettuce, tomato, and burger sauce. Every meal includes fries and a drink. Order for delivery or pickup in Helsinki.",
  },
};

async function getCategory(slug: string): Promise<RawCategory | null> {
  const { env } = await getCloudflareContext({ async: true });
  // Typed generic on .first() so the D1 row (defaults to
  // Record<string, unknown>) is assignable to this function's
  // Promise<RawCategory | null> return type without a separate cast.
  const row = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(slug).first<RawCategory>();
  return row || null;
}

export async function generateMetadata({ params }: { params: { locale: string; category: string } }) {
  const { locale, category: categorySlug } = params;
  const category = await getCategory(categorySlug);

  if (!category) {
    return { title: locale === 'fi' ? 'Ruokalista | ozy.fi' : 'Menu | ozy.fi' };
  }

  const title = resolveText(category.title, category.title_fi, locale);
  const sub = resolveText(category.sub, category.sub_fi, locale);
  const pageTitle = locale === 'fi' ? `${title} — Ruokalista | ozy.fi` : `${title} Menu — ozy.fi`;
  const description = sub || (locale === 'fi'
    ? `Selaa ${title}-valikoimaamme ja tilaa verkosta kotiinkuljetuksena tai noutona.`
    : `Browse our ${title} menu and order online for delivery or pickup.`);

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: `/${locale}/menu/${categorySlug}`,
      languages: hreflangAlternates(`/menu/${categorySlug}`),
    },
    openGraph: { title: pageTitle, description, url: `https://ozy.fi/${locale}/menu/${categorySlug}`, locale: locale === 'fi' ? 'fi_FI' : 'en_US', type: 'website' },
  };
}

export default async function CategoryMenuPage({ params }: { params: { locale: string; category: string } }) {
  // Not wrapped in try/catch: if getCategory() itself throws (a real D1
  // failure), we deliberately let that propagate to
  // app/(site)/[locale]/error.js rather than swallow it and call
  // notFound() — a database error is not the same thing as "this category
  // genuinely doesn't exist", and treating it as a 404 would hide a real
  // problem behind a misleading "not found" page (bug-fix, bilingual-site
  // crash, Sept 2026 — see error.js's comment for why that boundary now
  // exists to catch this safely instead of it reaching global-error.js).
  const category = await getCategory(params.category);

  if (!category) {
    notFound();
  }

  // This second D1 call (the full menu blob, for SSR-seeding the page)
  // gets the same defensive fallback as the other page.js files — see
  // app/(site)/[locale]/page.js for the full reasoning.
  let initialData: StoreProviderInitialData | null = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    initialData = await loadMenuData(env);
  } catch (err) {
    console.error(`[/${params?.locale}/menu/${params?.category}] failed to load SSR menu data:`, err);
  }

  const seoCopy = CATEGORY_SEO_COPY[params.category];
  const introText = seoCopy ? (params.locale === 'fi' ? seoCopy.fi : seoCopy.en) : null;

  const title = resolveText(category.title, category.title_fi, params.locale);
  // Schema.org Menu — a category-specific complement to the site-wide
  // Restaurant schema in app/(site)/[locale]/layout.tsx (which lists
  // servesCuisine generally); this ties the specific cuisine type to
  // this specific URL, which is what the Master SEO Plan's Phase 2
  // schema table calls for on the 3 hub pages.
  const menuSchema = seoCopy ? {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: title,
    inLanguage: params.locale,
    url: `https://ozy.fi/${params.locale}/menu/${params.category}`,
  } : null;

  return (
    <>
      {menuSchema && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(menuSchema) }} />
      )}
      <MenuPageClient onlyCategory={params.category} initialData={initialData} introText={introText} />
    </>
  );
}
