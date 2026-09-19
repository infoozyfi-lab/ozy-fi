import { getCloudflareContext } from '@opennextjs/cloudflare';
import { LOCALES, hreflangAlternates } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://ozy.fi';

interface SitemapEntryOptions {
  lastModified: Date;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

// Bilingual site — every URL below now needs BOTH a /fi and an /en entry
// (the brief: "both versions in the sitemap"), and each entry's
// `alternates.languages` cross-links to its sibling in the other
// language — the sitemap-level equivalent of the per-page hreflang
// <link> tags, and part of what makes Google treat /fi/menu and /en/menu
// as translations of each other instead of duplicate content.
function entry(path: string, { lastModified, changeFrequency, priority }: SitemapEntryOptions) {
  // hreflangAlternates() returns site-relative paths; the sitemap needs
  // full URLs, so prefix BASE_URL onto each one here.
  const relLanguages = hreflangAlternates(path);
  const languages = Object.fromEntries(
    Object.entries(relLanguages).map(([lang, relUrl]) => [lang, `${BASE_URL}${relUrl}`])
  );

  return LOCALES.map((locale: string) => ({
    url: `${BASE_URL}/${locale}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap() {
  const { env } = await getCloudflareContext({ async: true });

  // Typed generics so `c`/`p` below are real { id: string } rows, not
  // Record<string, unknown> — an explicitly-narrower callback parameter
  // annotation isn't reliably enough on its own for .flatMap() under the
  // real @cloudflare/workers-types + strict mode.
  const [categories, products] = await Promise.all([
    env.DB.prepare('SELECT id FROM categories').all<{ id: string }>(),
    env.DB.prepare('SELECT id FROM products WHERE active = 1').all<{ id: string }>(),
  ]);

  const now = new Date();

  const staticEntries = [
    ...entry('', { lastModified: now, changeFrequency: 'daily', priority: 1 }),
    ...entry('/menu', { lastModified: now, changeFrequency: 'daily', priority: 0.9 }),
    // Audit-fixes brief, Part 3 — these five real, indexable pages
    // (app/(site)/[locale]/{faq,about,contact,delivery,pickup}) existed
    // and were reachable via the header/footer nav, but were never listed
    // here, so a search engine had no explicit signal to crawl them at
    // all beyond stumbling onto internal links. Priorities/frequencies
    // follow this file's own existing convention: informational pages
    // that rarely change sit alongside /privacy and /terms below, not up
    // with the daily-changing menu.
    ...entry('/faq', { lastModified: now, changeFrequency: 'monthly', priority: 0.5 }),
    ...entry('/about', { lastModified: now, changeFrequency: 'monthly', priority: 0.4 }),
    ...entry('/contact', { lastModified: now, changeFrequency: 'monthly', priority: 0.4 }),
    ...entry('/delivery', { lastModified: now, changeFrequency: 'monthly', priority: 0.4 }),
    ...entry('/pickup', { lastModified: now, changeFrequency: 'monthly', priority: 0.4 }),
    ...entry('/privacy', { lastModified: now, changeFrequency: 'yearly', priority: 0.2 }),
    ...entry('/terms', { lastModified: now, changeFrequency: 'yearly', priority: 0.2 }),
    ...entry('/track', { lastModified: now, changeFrequency: 'monthly', priority: 0.3 }),
  ];

  const categoryEntries = categories.results.flatMap((c: { id: string }) =>
    entry(`/menu/${c.id}`, { lastModified: now, changeFrequency: 'weekly', priority: 0.7 })
  );

  const productEntries = products.results.flatMap((p: { id: string }) =>
    entry(`/product/${p.id}`, { lastModified: now, changeFrequency: 'weekly', priority: 0.6 })
  );

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
