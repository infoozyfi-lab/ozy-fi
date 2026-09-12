// Growth features batch 2 (Feature 5) — scheduled weekday offers.
//
// The ONE place that decides "is a given scheduled offer active right
// now" — shared between the server (app/api/orders/route.ts, which
// ENFORCES this at order-creation time using the server clock) and the
// client (context/StoreContext.tsx / components/Header.tsx /
// components/CheckoutModal.tsx, which only use it to show a banner).
// Deliberately pure functions with no server-only or DOM dependency, so
// the exact same code runs in both places — no parallel/duplicated
// "is it Monday 5-9pm" logic to keep in sync.
//
// This project has no pre-existing server-side timezone/day-of-week
// evaluation anywhere else: admin_settings.opening_hours (see
// app/admin/dashboard/page.tsx's OPENING_HOURS_DAYS) is rendered for
// display only (components/Visit.tsx) and is never checked against the
// current time. So this module is new, not a reuse of existing logic —
// it DOES reuse the existing day-key convention ('mon'..'sun') from
// opening_hours for consistency, and Cloudflare Workers' built-in
// Intl.DateTimeFormat (with timeZone: 'Europe/Helsinki') to get the
// correct wall-clock day/time in Finland regardless of the server's own
// clock/timezone, without adding a timezone library dependency.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && (DAY_KEYS as readonly string[]).includes(value);
}

// Raw D1 row shape for the scheduled_offers table (worker/schema.sql) —
// mirrors lib/types.ts's other Raw* row shapes (e.g. RawBundle).
export interface RawScheduledOffer {
  id: string;
  label: string;
  days?: string; // JSON-encoded DayKey[]
  start_time?: string | null;
  end_time?: string | null;
  discount_percent: number | string;
  active?: number;
  sort_order?: number;
  [key: string]: unknown;
}

// Normalized shape used by MenuBlob (lib/menu-i18n.ts) and everywhere
// else in the app — parsed once, not re-parsed on every use.
export interface ScheduledOffer {
  id: string;
  label: string;
  days: DayKey[];
  startTime: string | null; // 'HH:MM', null means "all day" (with endTime)
  endTime: string | null;
  discountPercent: number;
}

// Parses scheduled_offers.days (a JSON-encoded array, same "JSON in a
// TEXT column" precedent as bundles.slots) into a clean DayKey[],
// silently dropping anything that isn't a recognized day key rather than
// throwing — an admin typo here should never take down menu loading.
export function parseDays(raw: string | null | undefined): DayKey[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDayKey);
  } catch {
    return [];
  }
}

export function normalizeScheduledOffer(row: RawScheduledOffer): ScheduledOffer {
  return {
    id: row.id,
    label: row.label,
    days: parseDays(row.days),
    startTime: row.start_time && row.start_time.trim() ? row.start_time.trim() : null,
    endTime: row.end_time && row.end_time.trim() ? row.end_time.trim() : null,
    discountPercent: Number(row.discount_percent) || 0,
  };
}

// 'HH:MM' -> minutes since midnight, or null if not a valid HH:MM string.
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Current day-of-week + minutes-since-midnight in Europe/Helsinki, from
// the given instant (defaults to "now"). Uses Intl.DateTimeFormat rather
// than a Date's local getters, since the server process itself typically
// runs in UTC (Cloudflare Workers) and a browser's local time is the
// visitor's own, neither of which is Helsinki time.
export function getHelsinkiNow(at: Date = new Date()): { dayKey: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? '';
  // Intl gives e.g. "Mon", "Tue" — map to our lowercase 3-letter keys.
  const dayKey = (weekdayShort.slice(0, 3).toLowerCase() as DayKey) || 'mon';

  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  // Intl's hour12:false can format midnight as "24" in some environments
  // — normalize back into 0-23.
  if (hour === 24) hour = 0;

  return { dayKey: isDayKey(dayKey) ? dayKey : 'mon', minutes: hour * 60 + minute };
}

// Is this one offer active at the given Helsinki day/minute-of-day?
// Blank start/end (both null) means "all day". A same-day time window is
// assumed (e.g. 17:00-21:00) — this project's opening-hours model is the
// same shape and doesn't support overnight-spanning windows either, so
// this doesn't introduce a new concept.
export function isOfferActiveAt(offer: ScheduledOffer, dayKey: DayKey, minutes: number): boolean {
  if (!offer.days.includes(dayKey)) return false;
  const start = parseTimeToMinutes(offer.startTime);
  const end = parseTimeToMinutes(offer.endTime);
  if (start === null || end === null) return true; // "all day"
  return minutes >= start && minutes <= end;
}

// Admin-input validation for POST/PUT /api/admin/scheduled_offers[/:id] —
// shared by both routes (app/api/admin/[table]/route.ts and
// app/api/admin/[table]/[id]/route.ts) so the rules live in one place,
// same reasoning as findBestActiveScheduledOffer above. Operates only on
// whatever fields are present in the request body (an admin PUT can be a
// partial update, e.g. just the `active` toggle) — returns an error
// message string, or null if the body (or the subset of it provided) is
// valid.
export function validateScheduledOfferInput(body: Record<string, unknown>): string | null {
  if ('days' in body) {
    let parsedDays: unknown;
    try {
      parsedDays = JSON.parse(String(body.days ?? '[]'));
    } catch {
      return 'days must be a JSON array of day keys.';
    }
    if (!Array.isArray(parsedDays) || parsedDays.length === 0) {
      return 'Select at least one day.';
    }
    if (!parsedDays.every(isDayKey)) {
      return 'days contains an invalid day key.';
    }
  }

  if ('discount_percent' in body) {
    const pct = Number(body.discount_percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return 'Discount must be a percentage greater than 0 and at most 100.';
    }
  }

  if ('start_time' in body || 'end_time' in body) {
    const startRaw = body.start_time;
    const endRaw = body.end_time;
    const startBlank = startRaw === null || startRaw === undefined || startRaw === '';
    const endBlank = endRaw === null || endRaw === undefined || endRaw === '';
    if (startBlank !== endBlank) {
      return 'Set both a start and end time, or leave both blank for "all day".';
    }
    if (!startBlank) {
      const start = parseTimeToMinutes(String(startRaw));
      const end = parseTimeToMinutes(String(endRaw));
      if (start === null || end === null) {
        return 'Start/end time must be in HH:MM format.';
      }
      if (start >= end) {
        return 'Start time must be before end time.';
      }
    }
  }

  if ('label' in body && !String(body.label ?? '').trim()) {
    return 'Label is required.';
  }

  return null;
}

// Among all ACTIVE (active=1, already filtered by the caller/DB query)
// scheduled offers, returns the one that is live right now and most
// favorable to the customer (highest discountPercent) — or null if none
// apply. If more than one offer happens to be active at once (e.g.
// overlapping configurations), the higher percentage wins, consistent
// with "the discount most favorable to the customer applies" used
// elsewhere (coupon vs. welcome discount).
export function findBestActiveScheduledOffer(
  offers: ScheduledOffer[],
  at: Date = new Date()
): ScheduledOffer | null {
  const { dayKey, minutes } = getHelsinkiNow(at);
  let best: ScheduledOffer | null = null;
  for (const offer of offers) {
    if (!isOfferActiveAt(offer, dayKey, minutes)) continue;
    if (!best || offer.discountPercent > best.discountPercent) best = offer;
  }
  return best;
}
