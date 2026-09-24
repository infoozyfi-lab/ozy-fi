// Round-2 fixes brief, Part 6 (item 2) — "the hero unconditionally shows
// 'Open now' regardless of the real store_closed flag and configured
// opening hours." Before this file, nothing in this codebase ever
// checked admin_settings.opening_hours against the current time —
// lib/scheduledOffers.ts's own header comment says so explicitly
// ("admin_settings.opening_hours... is rendered for display only... and
// is never checked against the current time"), and that comment was
// accurate: components/Visit.tsx and PublicSettingsInfo.tsx only ever
// format the configured rows for display.
//
// This is a small, dependency-free addition reusing that exact same
// Helsinki-day/time logic (getHelsinkiNow/parseTimeToMinutes) rather than
// re-deriving it a second time, so this and the scheduled-offer "is it
// active right now" check can never disagree about what time it actually
// is.
import { getHelsinkiNow, parseTimeToMinutes, DAY_KEYS, type DayKey } from './scheduledOffers';
import type { OpeningHours } from './types';

// Priority-fixes brief (roadmap gap analysis), Part 7 — special/holiday
// hours. One entry overrides the regular weekly schedule for a single
// calendar date (Helsinki-local) — e.g. closed for a public holiday, or
// open shorter hours on Christmas Eve. Stored as a JSON array under the
// existing admin_settings.special_hours key (same "JSON in a TEXT
// column" precedent as opening_hours/scheduled_offers.days — no new
// table), read/written by app/admin/dashboard/page.tsx's Special hours
// editor and parsed here by parseSpecialHours(). `date` is a plain
// 'YYYY-MM-DD' string compared against getHelsinkiDateString() below —
// deliberately not a Date object, so equality is a simple string compare
// with no timezone ambiguity.
export interface SpecialHoursEntry {
  date: string; // 'YYYY-MM-DD', Helsinki-local
  closed: boolean;
  open?: string | null; // 'HH:MM', ignored when closed is true
  close?: string | null;
}

// Parses admin_settings.special_hours (a JSON-encoded array) into a clean
// SpecialHoursEntry[], silently dropping anything malformed rather than
// throwing — same defensive contract as lib/scheduledOffers.ts's
// parseDays for admin-authored JSON.
export function parseSpecialHours(raw: string | null | undefined): SpecialHoursEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is SpecialHoursEntry => {
      return !!e && typeof e === 'object' && typeof (e as SpecialHoursEntry).date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((e as SpecialHoursEntry).date);
    });
  } catch {
    return [];
  }
}

// Today's (or any instant's) date in Helsinki-local 'YYYY-MM-DD' — the
// same Intl-based approach as getHelsinkiNow, needed to match a
// SpecialHoursEntry.date against "right now" regardless of the server
// process's own timezone (Workers runs in UTC).
export function getHelsinkiDateString(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

// Adds `days` calendar days to a Helsinki-local date string, returning
// the result as the same 'YYYY-MM-DD' shape — used by getNextTransition
// to look a few days ahead for the next day the store opens. Constructed
// as a UTC noon instant (never midnight) specifically so adding whole
// days can never itself cross a Helsinki-local day boundary by accident
// via DST — noon UTC is always within the same Helsinki calendar date
// either side of either DST transition.
function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return getHelsinkiDateString(dt);
}

const DATE_TO_DAY_KEY_ANCHOR = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Helsinki', weekday: 'short' });

// Which weekday ('mon'..'sun') a given 'YYYY-MM-DD' Helsinki-local date
// string falls on — used to look up that date's row in the regular
// weekly `openingHours` schedule when no special-hours override exists
// for it.
function dayKeyForDateString(dateStr: string): DayKey {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekdayShort = DATE_TO_DAY_KEY_ANCHOR.format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
  const key = weekdayShort.slice(0, 3).toLowerCase();
  return (DAY_KEYS as readonly string[]).includes(key) ? (key as DayKey) : 'mon';
}

// The effective { closed, open, close } for one specific calendar date —
// a special-hours entry for that exact date wins when one is configured;
// otherwise falls back to that date's row in the regular weekly
// schedule. Returns null when there's nothing configured either way (no
// special entry AND no weekly schedule at all), matching isOpenNow's own
// "nothing configured -> don't assert a hard fact" stance.
function getEffectiveHoursForDate(
  openingHours: OpeningHours,
  specialHours: SpecialHoursEntry[] | null | undefined,
  dateStr: string
): { closed: boolean; open: string | null; close: string | null } | null {
  const special = (specialHours || []).find((e) => e.date === dateStr);
  if (special) {
    return { closed: special.closed, open: special.open || null, close: special.close || null };
  }
  if (!Array.isArray(openingHours)) return null;
  const dayKey = dayKeyForDateString(dateStr);
  const row = openingHours.find((d) => d.day === dayKey);
  if (!row) return null;
  return { closed: row.closed, open: row.open || null, close: row.close || null };
}

// Real open/closed state for right now — combines both real signals that
// exist in this codebase:
// - admin_settings.store_closed — a manual, immediate override (e.g. the
//   kitchen is unexpectedly shut, a holiday) — always wins when true,
//   regardless of what the configured hours say.
// - admin_settings.opening_hours — the day's configured window. Unset/not
//   yet loaded (null) is treated as "no configured hours to check
//   against" — true (assume open) rather than false, so the hero doesn't
//   flash "closed" for every visitor before the menu data has loaded, the
//   same "real data, harmless default until loaded" contract this
//   codebase already uses for contactInfo/openingHours elsewhere (see
//   context/StoreContext.tsx).
// `specialHours` is optional (and defaults to "none configured") purely
// so every pre-existing call site of this function keeps compiling
// unchanged — see Part 7's own comment on SpecialHoursEntry above for
// what it does when present. When today has a special-hours entry, it
// REPLACES today's regular weekly row entirely (including when it marks
// today closed, even if the weekly schedule would otherwise say open).
export function isOpenNow(
  openingHours: OpeningHours,
  storeClosed: boolean,
  at: Date = new Date(),
  specialHours?: SpecialHoursEntry[] | null
): boolean {
  if (storeClosed) return false;

  const { dayKey, minutes } = getHelsinkiNow(at);
  const dateStr = getHelsinkiDateString(at);
  const special = (specialHours || []).find((e) => e.date === dateStr);

  if (special) {
    if (special.closed) return false;
    const start = parseTimeToMinutes(special.open);
    const end = parseTimeToMinutes(special.close);
    if (start === null || end === null) return true; // Marked open but no real times set — don't invent a "closed" state.
    return minutes >= start && minutes <= end;
  }

  if (!Array.isArray(openingHours)) return true;

  const today = openingHours.find((d) => d.day === dayKey);
  if (!today) return true; // Configured hours don't include today at all — nothing to contradict "open".
  if (today.closed) return false;

  const start = parseTimeToMinutes(today.open);
  const end = parseTimeToMinutes(today.close);
  if (start === null || end === null) return true; // Marked open but no real times set — don't invent a "closed" state.
  return minutes >= start && minutes <= end;
}

// Priority-fixes brief (roadmap gap analysis), Part 5 — "next opening/
// closing time" messaging (coordinated with Part 7's special hours,
// which this consults via getEffectiveHoursForDate so the two features
// can never disagree about what today's real hours are).
//
// Returns null when nothing useful can be said (the manual store_closed
// override is on — we genuinely don't know when that lifts — or there's
// no configured schedule at all to compute from). Otherwise:
// - isOpen: what isOpenNow() would say right now.
// - time: the 'HH:MM' of the next transition (today's close time if
//   open now; the next open time otherwise).
// - daysAhead: 0 if that time is later today, 1 for tomorrow, etc. Only
//   used when !isOpen — an open store's own closing time is always later
//   today (this project's opening-hours model has no overnight-spanning
//   windows, same assumption lib/scheduledOffers.ts already makes).
export interface NextTransition {
  isOpen: boolean;
  time: string;
  daysAhead: number;
}

const MAX_LOOKAHEAD_DAYS = 7;

export function getNextTransition(
  openingHours: OpeningHours,
  storeClosed: boolean,
  at: Date = new Date(),
  specialHours?: SpecialHoursEntry[] | null
): NextTransition | null {
  if (storeClosed) return null; // Manual override — no computed reopening time to show.

  const { minutes } = getHelsinkiNow(at);
  const todayStr = getHelsinkiDateString(at);
  const todayHours = getEffectiveHoursForDate(openingHours, specialHours, todayStr);

  if (todayHours && !todayHours.closed) {
    const start = parseTimeToMinutes(todayHours.open);
    const end = parseTimeToMinutes(todayHours.close);
    if (start !== null && end !== null) {
      if (minutes >= start && minutes <= end) {
        return { isOpen: true, time: todayHours.close as string, daysAhead: 0 };
      }
      if (minutes < start) {
        return { isOpen: false, time: todayHours.open as string, daysAhead: 0 };
      }
      // Past today's close — fall through to search for the next day
      // that opens, below.
    } else {
      // "Open, no specific times set" — isOpenNow treats this as open
      // with nothing to report a transition for.
      return null;
    }
  } else if (!todayHours) {
    // Nothing configured for today at all (no special entry, no weekly
    // schedule) — isOpenNow defaults to "open" here too, with no real
    // transition time to compute.
    return null;
  }

  // Closed right now (either today is marked closed, or today's window
  // already ended) — look ahead for the next day this data actually
  // says the store opens.
  for (let days = 1; days <= MAX_LOOKAHEAD_DAYS; days += 1) {
    const dateStr = addDaysToDateString(todayStr, days);
    const hours = getEffectiveHoursForDate(openingHours, specialHours, dateStr);
    if (hours && !hours.closed) {
      const start = parseTimeToMinutes(hours.open);
      if (start !== null) {
        return { isOpen: false, time: hours.open as string, daysAhead: days };
      }
    }
  }

  return null; // Closed every configured day within the lookahead window.
}
