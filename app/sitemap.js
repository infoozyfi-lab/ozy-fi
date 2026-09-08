import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://ozy.fi';

export default async function sitemap() {
  const { env } = await getCloudflareContext({ async: true });

  const [categories, products] = await Promise.all([
    env.DB.prepare('SELECT id FROM categories').all(),
    env.DB.prepare('SELECT id FROM products WHERE active = 1').all(),
  ]);

  const now = new Date();

  const staticEntries = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/menu`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/track`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const categoryEntries = categories.results.map((c) => ({
    url: `${BASE_URL}/menu/${c.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const productEntries = products.results.map((p) => ({
    url: `${BASE_URL}/product/${p.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
