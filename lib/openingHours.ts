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
import { getHelsinkiNow, parseTimeToMinutes } from './scheduledOffers';
import type { OpeningHours } from './types';

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
export function isOpenNow(openingHours: OpeningHours, storeClosed: boolean, at: Date = new Date()): boolean {
  if (storeClosed) return false;
  if (!Array.isArray(openingHours)) return true;

  const { dayKey, minutes } = getHelsinkiNow(at);
  const today = openingHours.find((d) => d.day === dayKey);
  if (!today) return true; // Configured hours don't include today at all — nothing to contradict "open".
  if (today.closed) return false;

  const start = parseTimeToMinutes(today.open);
  const end = parseTimeToMinutes(today.close);
  if (start === null || end === null) return true; // Marked open but no real times set — don't invent a "closed" state.
  return minutes >= start && minutes <= end;
}
