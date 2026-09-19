// SEO gap-fill, Part C — a small, dedicated admin_settings reader for the
// new /about, /contact, /delivery and /pickup pages. Deliberately NOT
// loadMenuData() (lib/menu-data.ts): that fetches the full menu — 8
// parallel D1 queries (categories/products/option groups/options/addons/
// bundles/settings/scheduled offers) — for pages that only ever need the
// settings row. Same "SELECT key, value ... WHERE key IN (...)" shape as
// the existing getRestaurantSchema (app/(site)/[locale]/layout.tsx) and
// lib/server-tracking.ts, just with the keys these four new pages read.
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { OpeningHours } from './types';

export interface PublicSettings {
  restaurant_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  minimum_order?: string;
  delivery_fee?: string;
  delivery_postal_codes?: string;
  opening_hours?: string;
}

const PUBLIC_SETTINGS_KEYS: (keyof PublicSettings)[] = [
  'restaurant_name', 'phone', 'email', 'address',
  'minimum_order', 'delivery_fee', 'delivery_postal_codes', 'opening_hours',
];

// Every value is a plain string or simply absent — callers decide their
// own fallback/placeholder for an absent key (same "s.restaurant_name ||
// 'ozy.fi'"-style pattern getRestaurantSchema already uses), never a
// default guessed here. Wrapped in try/catch, same reasoning as every
// other non-essential D1 call in this codebase (see e.g. loadMenuData's
// callers in the category/product pages): a settings-lookup failure
// should degrade these informational pages to their placeholder state,
// never turn into a 500.
export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const placeholders = PUBLIC_SETTINGS_KEYS.map(() => '?').join(', ');
    const rows = await env.DB.prepare(
      `SELECT key, value FROM admin_settings WHERE key IN (${placeholders})`
    ).bind(...PUBLIC_SETTINGS_KEYS).all<{ key: string; value: string }>();
    const s: Record<string, string> = {};
    for (const row of rows.results) s[row.key] = row.value;
    return s as PublicSettings;
  } catch (err) {
    console.error('[site-settings] failed to load admin_settings:', err);
    return {};
  }
}

// Same parse rule as lib/menu-i18n.ts's normalizeMenuBlob and
// app/admin/dashboard/page.tsx's parseOpeningHours: a valid 7-day JSON
// array, or null for anything else (unset, old free-text value, corrupt
// JSON). Kept as its own small copy here rather than importing either of
// those — normalizeMenuBlob is bundled with unrelated menu-normalization
// logic these pages don't need, and the dashboard copy lives in a
// 'use client' admin file — rather than forking either module's shape
// just to reach a 3-line pure function twice more.
export function parseOpeningHoursSetting(raw: string | undefined): OpeningHours {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 7 ? parsed : null;
  } catch {
    return null;
  }
}

// Same row-shaping as components/Visit.tsx's formatHoursRows, reusing the
// exact same t.visit.days/t.visit.closed/t.visit.fallbackRows dictionary
// keys — no new translation strings needed for this. `t` is `any` (see
// lib/i18n/locales.ts's getDictionary — this whole codebase treats the
// dictionary as untyped).
export function formatOpeningHoursRows(hours: OpeningHours, t: any): { label: string; value: string }[] {
  if (!Array.isArray(hours)) return t.visit.fallbackRows;
  return hours.map((d) => ({
    label: t.visit.days[d.day] || d.day,
    value: d.closed ? t.visit.closed : `${d.open} – ${d.close}`,
  }));
}
