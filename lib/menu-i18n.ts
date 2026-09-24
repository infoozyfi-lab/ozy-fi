// Shared menu-data shaping + localization — the single place that turns
// the raw D1 rows (categories/products/option_groups/options/addons/
// bundles/admin_settings, exactly what loadMenuData()/`/api/menu` return)
// into the shape context/StoreContext.js's state actually uses.
//
// Used from TWO places, deliberately kept in sync via this one function
// rather than two copies of the same logic:
//   1. Server Components (app/(site)/[locale]/*/page.js) — to build a
//      correctly-shaped, correctly-localized `initialData` for first
//      paint / SSR HTML (see this feature's summary for a pre-existing
//      shape mismatch this also happens to fix).
//   2. context/StoreContext.js's client-side `/api/menu` fetch effect.
//
// Translatable-field fallback: every `_fi` column added for the
// bilingual site (Phase: bilingual site) is optional — if a business
// owner hasn't filled in a Finnish translation for a given product yet,
// the English/default value is shown instead, on the Finnish site too.
// See lib/i18n/locales.js's resolveText().
import { resolveText } from './i18n/locales';
import { normalizeScheduledOffer } from './scheduledOffers';
import { readDiscountSetting } from './pricing';
import { parseSpecialHours } from './openingHours';
import type {
  Locale,
  RawCategory,
  RawProduct,
  MenuData,
  Category,
  Product,
  OptionItem,
  FillingCategory,
  Addon,
  Bundle,
  TrackingConfig,
  Featured,
  MenuBlob,
  StoryBannerImage,
} from './types';

// Bundle 1 Task 5 — story banner slider. Same "corrupt/unset -> empty,
// never crash" fallback as parseSpecialHours (lib/openingHours.ts) and
// this file's own popularProductIds parse below. Each entry is
// re-validated shape-wise (not just `Array.isArray`) since this is
// admin-authored JSON stored as plain TEXT — a hand-edited or
// half-migrated value should degrade to "fewer/no slides", never crash
// the homepage. Capped at 10 defensively (the admin UI already enforces
// this at save time — see app/admin/dashboard/page.tsx — this is a
// second, independent guard against a stored value ever exceeding it).
function parseStoryBannerImages(raw: string | null | undefined): StoryBannerImage[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        url: typeof item.url === 'string' ? item.url : '',
        alt: typeof item.alt === 'string' ? item.alt : '',
      }))
      .filter((item) => item.url)
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------
// Categories / products — the subset that Server Components seed as
// `initialData` for SSR (see the brief: /menu, /menu/[category],
// /product/[id] and / all need real server-rendered content, not just
// client-fetched). Kept as two small named functions (rather than only
// the full-blob one below) so a Server Component that only needs, say,
// categories for a nav list doesn't have to build a whole fake menu blob
// first.
// ---------------------------------------------------------------------

export function normalizeCategories(rawCategories: RawCategory[] | null | undefined, locale: Locale): Category[] {
  return (rawCategories || []).map((cat) => ({
    id: cat.id,
    title: resolveText(cat.title, cat.title_fi, locale),
    sub: resolveText(cat.sub, cat.sub_fi, locale),
    image: cat.image,
    sort_order: cat.sort_order,
  }));
}

export function normalizeProducts(rawProducts: RawProduct[] | null | undefined, locale: Locale): Product[] {
  return (rawProducts || [])
    .filter((item) => item.active !== 0)
    .map((item) => ({
      id: item.id,
      cat: item.category_id,
      name: resolveText(item.name, item.name_fi, locale),
      desc: resolveText(item.description, item.description_fi, locale),
      price: item.offer_price !== null && item.offer_price !== undefined ? Number(item.offer_price) : Number(item.price),
      basePrice: Number(item.price),
      offerPrice: item.offer_price !== null && item.offer_price !== undefined ? Number(item.offer_price) : null,
      image: item.image,
      tag: item.tag,
      toppings: Boolean(item.has_toppings),
      toppingsEnabled: Boolean(item.has_toppings),
      sort_order: item.sort_order,
      // Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 2 — see
      // Product.searchText's comment (lib/types.ts). Built from every raw
      // bilingual text field this row has, regardless of `locale`, so a
      // customer searching the Finnish site for an English word (or vice
      // versa) still finds the item. Missing translations (untranslated
      // fields are null/undefined) are simply skipped rather than falling
      // back to the resolved text twice.
      searchText: [item.name, item.name_fi, item.description, item.description_fi]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .join(' ')
        .toLowerCase(),
    }));
}

// Fallback single-option lists used only until data has loaded, so the UI
// never crashes on first paint. Mirrors context/StoreContext.js's own
// FALLBACK_OPTION — kept here too since normalizeMenuBlob needs the same
// shape when a group is genuinely empty.
const FALLBACK_OPTION: OptionItem[] = [{ id: 'default', label: 'Default', delta: 0 }];
const FALLBACK_SAUCE_STRIPE: OptionItem[] = [{ id: 'default', label: 'None', delta: 0, color: 'transparent' }];

// ---------------------------------------------------------------------
// The full menu blob — option groups (base/sauce/cheese/sauce_stripe/
// dip/topping/filling), addons (drinks/dips/snacks), bundles, and the
// handful of admin_settings this app reads. Mirrors exactly what
// context/StoreContext.js's loadMenu() effect used to build inline —
// moved here so Server Components *could* also use it later without
// duplicating the mapping logic, and so there's exactly one place that
// knows how a raw /api/menu payload becomes app state.
// ---------------------------------------------------------------------

export function normalizeMenuBlob(raw: MenuData, locale: Locale): MenuBlob {
  const categories = normalizeCategories(raw.categories, locale);
  const products = normalizeProducts(raw.products, locale);

  let baseOptions = FALLBACK_OPTION;
  let sauceOptions = FALLBACK_OPTION;
  let cheeseOptions = FALLBACK_OPTION;
  let sauceStripeOptions = FALLBACK_SAUCE_STRIPE;
  let dipOptions = FALLBACK_OPTION;
  let toppings: OptionItem[] = [];
  const fillingCategories: FillingCategory[] = [];

  const groups = raw.optionGroups || [];
  groups.forEach((g) => {
    const opts: OptionItem[] = (g.options || []).map((o) => ({
      id: o.id,
      label: resolveText(o.label, o.label_fi, locale),
      delta: Number(o.price_delta) || 0,
      color: o.color || null,
    }));

    switch (g.kind) {
      case 'base':
        baseOptions = opts.length ? opts : FALLBACK_OPTION;
        break;
      case 'sauce':
        sauceOptions = opts.length ? opts : FALLBACK_OPTION;
        break;
      case 'cheese':
        cheeseOptions = opts.length ? opts : FALLBACK_OPTION;
        break;
      case 'sauce_stripe':
        sauceStripeOptions = opts.length ? opts : FALLBACK_SAUCE_STRIPE;
        break;
      case 'dip':
        dipOptions = opts.length ? opts : FALLBACK_OPTION;
        break;
      case 'topping':
        toppings = opts;
        break;
      case 'filling':
        fillingCategories.push({
          id: g.id,
          title: resolveText(g.title, g.title_fi, locale),
          icon: g.icon,
          items: (g.options || []).map((o) => ({
            id: o.id,
            label: resolveText(o.label, o.label_fi, locale),
            price: Number(o.price_delta) || 0,
          })),
        });
        break;
      default:
        break;
    }
  });

  const addons = raw.addons || [];
  const mapAddon = (a: (typeof addons)[number]): Addon => ({ id: a.id, name: resolveText(a.name, a.name_fi, locale), price: Number(a.price) || 0, image: a.image });
  const drinks = addons.filter((a) => a.type === 'drink').map(mapAddon);
  const dipCups = addons.filter((a) => a.type === 'dip').map(mapAddon);
  const snacks = addons.filter((a) => a.type === 'snack').map(mapAddon);

  const bundles: Bundle[] = (raw.bundles || []).map((b) => {
    let slots = [];
    try {
      slots = JSON.parse(b.slots || '[]');
    } catch {
      slots = [];
    }
    return {
      id: b.id,
      title: resolveText(b.title, b.title_fi, locale),
      description: resolveText(b.description, b.description_fi, locale),
      image: b.image,
      price: Number(b.price) || 0,
      slots,
    };
  });

  const settings = raw.settings || {};
  const sizeLargeUpcharge = Number(settings.size_large_upcharge) || 0;
  const storeClosed = settings.store_closed === '1';
  // Growth features — shared discount-value shape (see lib/types.ts's
  // DiscountValue). readDiscountSetting falls back to a value of 0 when
  // unconfigured, same "0 means disabled" behavior these were as bare
  // percent fields before this task.
  const firstOrderDiscount = readDiscountSetting(settings, 'first_order_discount');
  const stampCardReward = readDiscountSetting(settings, 'stamp_card_reward');
  // Growth features batch 2 (Feature 5) — normalize once here (parsing
  // `days` JSON, resolving the discount shape) rather than in every
  // consumer. Whether one is active RIGHT NOW is NOT decided here — see
  // lib/scheduledOffers.ts's findBestActiveScheduledOffer, called from
  // context/StoreContext.tsx (client) and app/api/orders/route.ts
  // (server, the one that actually enforces it).
  const scheduledOffers = (raw.scheduledOffers || []).map(normalizeScheduledOffer);
  const trackingConfig: TrackingConfig = {
    ga4Id: settings.ga4_measurement_id || null,
    metaPixelId: settings.meta_pixel_id || null,
    tiktokPixelId: settings.tiktok_pixel_id || null,
    clarityId: settings.clarity_id || null,
  };

  // Old free-text values (or nothing set yet) fail this parse and stay
  // null — see components/Visit.js for the placeholder fallback.
  let openingHours = null;
  try {
    const parsedHours = JSON.parse(settings.opening_hours || 'null');
    openingHours = Array.isArray(parsedHours) && parsedHours.length === 7 ? parsedHours : null;
  } catch {
    openingHours = null;
  }

  const featured: Featured = {
    type: settings.featured_type || 'none',
    bannerImage: settings.featured_banner_image || '',
    bannerTitle: settings.featured_banner_title || '',
    bannerPrice: settings.featured_banner_price || '',
    productId: settings.featured_product_id || '',
    bundleId: settings.featured_bundle_id || '',
  };

  let popularProductIds = [];
  try {
    popularProductIds = JSON.parse(settings.popular_product_ids || '[]');
  } catch {
    popularProductIds = [];
  }

  // Priority-fixes brief (roadmap gap analysis), Part 7 — special/
  // holiday hours (admin_settings.special_hours). Same "parse once here,
  // not in every consumer" reasoning as scheduledOffers above.
  const specialHours = parseSpecialHours(settings.special_hours);

  // Bundle 1 Task 5 — story banner slider.
  const storyBannerImages = parseStoryBannerImages(settings.story_banner_images);

  return {
    categories,
    products,
    baseOptions,
    sauceOptions,
    cheeseOptions,
    sauceStripeOptions,
    dipOptions,
    toppings,
    fillingCategories,
    drinks,
    dipCups,
    snacks,
    bundles,
    sizeLargeUpcharge,
    storeClosed,
    trackingConfig,
    openingHours,
    featured,
    popularProductIds,
    firstOrderDiscount,
    stampCardReward,
    scheduledOffers,
    specialHours,
    storyBannerImages,
  };
}
