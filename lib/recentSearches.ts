'use client';

// Search-improvements brief, item 4 — "recent searches". Per-visitor UI
// convenience, not account data (the brief's own framing), so plain
// localStorage is the right fit — no server storage, no new API
// endpoint. Kept as its own tiny module (rather than inline in
// components/MenuSection.tsx) so the storage logic itself is unit-
// testable without rendering React — see worker/test-data/
// recent-searches-verify.js.

const KEY = 'ozy_recent_searches';
const MAX_ENTRIES = 5;
const MIN_LENGTH = 2; // a single stray character isn't worth remembering

function safeParse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** Current list, most-recent-first. Empty (never throws) if unavailable. */
export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.localStorage.getItem(KEY));
  } catch {
    // Storage disabled (private browsing in some browsers, quota, etc.)
    // — recent searches simply don't persist; never breaks search itself.
    return [];
  }
}

/**
 * Records a completed search, de-duplicated case-insensitively and moved
 * to the front, capped at MAX_ENTRIES. Returns the updated list so the
 * caller can update its own state in the same tick without a second
 * read. A query shorter than MIN_LENGTH, or storage being unavailable,
 * is a silent no-op — this is a convenience feature, never something
 * that should surface an error to the customer.
 */
export function addRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  const current = getRecentSearches();
  if (trimmed.length < MIN_LENGTH) return current;

  const deduped = current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...deduped].slice(0, MAX_ENTRIES);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Quota/private-mode — the in-memory `next` is still returned below
      // so the UI reflects it for the rest of this session even though it
      // won't survive a reload.
    }
  }

  return next;
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do if storage is unavailable — there's nothing to clear.
  }
}
