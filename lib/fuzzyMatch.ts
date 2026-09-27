// Search-improvements brief, items 1 ("typo-tolerant matching"), 2
// ("highlight the matched portion"), and 5 ("did you mean") — a small,
// dependency-free Levenshtein-based fuzzy matcher, per that brief's own
// standing rule ("no new npm dependency... implement the small amount of
// matching logic needed directly, given this project's modest catalog
// size"). Pure functions, no React/DOM — usable from components/
// MenuSection.tsx and testable in plain Node (see worker/test-data/
// fuzzy-match-verify.js).

/**
 * Classic full Levenshtein edit distance (insert/delete/substitute, all
 * cost 1) between two strings, computed with a rolling two-row table
 * (O(min matter) memory, not the full O(m*n) matrix — this project's
 * catalog is small enough that this is a readability choice more than a
 * performance necessity, but it costs nothing here).
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

/**
 * How many edits a query of this length is allowed to be off by before
 * we stop calling it "the same word" — scales with query length so a
 * very short query (2-3 chars) doesn't fuzz-match almost anything, per
 * the brief's own "1-2 character difference" framing.
 */
export function maxDistanceFor(queryLength: number): number {
  if (queryLength <= 3) return 0;
  if (queryLength <= 5) return 1;
  return 2;
}

export interface FuzzyMatch {
  start: number;
  end: number;
  distance: number;
}

// Unicode-aware "word" tokenizer (\p{L}/\p{N} cover Finnish's ä/ö/å same
// as any other letter) — used so fuzzy matching compares the query
// against actual words, not arbitrary substrings of a whole sentence.
// Cheaper AND more accurate than a sliding character-window over the
// entire text: catalog text here is short (product names/descriptions),
// so per-word comparison is more than fast enough and gives much better
// highlight spans (a whole word, not a random slice of one).
function tokenize(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/**
 * Finds the best fuzzy occurrence of `query` inside `text` (both expected
 * pre-lowercased by the caller — this file has no opinion on casing).
 * Tries, per word: the exact substring first (cheapest, most common
 * case, distance 0); then the whole word; then the word's own prefix/
 * suffix cut to the query's length, so a query that's a truncated or
 * extended form of a real word (e.g. "bologna" against "bolognese") is
 * still found even though the whole-word edit distance would be too
 * large. Returns the closest match found within the length-scaled
 * distance budget, or null if nothing is close enough.
 */
export function findFuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (!query) return null;

  const exactIdx = text.indexOf(query);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + query.length, distance: 0 };
  }

  const maxDist = maxDistanceFor(query.length);
  if (maxDist === 0) return null;

  let best: FuzzyMatch | null = null;

  for (const { word, start, end } of tokenize(text)) {
    // Cheap pre-filter — a word wildly different in length from the
    // query can never land within the distance budget, so skip the
    // Levenshtein calls entirely for it.
    if (Math.abs(word.length - query.length) > maxDist + 2) continue;

    const candidates: { text: string; start: number }[] = [
      { text: word, start },
    ];
    if (word.length > query.length) {
      candidates.push({ text: word.slice(0, query.length), start });
      candidates.push({ text: word.slice(-query.length), start: end - query.length });
    }

    for (const cand of candidates) {
      if (!cand.text) continue;
      const dist = levenshtein(cand.text, query);
      if (dist <= maxDist && (!best || dist < best.distance)) {
        best = { start: cand.start, end: cand.start + cand.text.length, distance: dist };
        if (dist === 0) return best;
      }
    }
  }

  return best;
}

/** Boolean convenience wrapper around findFuzzyMatch. */
export function fuzzyContains(text: string, query: string): boolean {
  return findFuzzyMatch(text, query) !== null;
}

/**
 * Item 5 — "did you mean". Only ever called once a search has already
 * come up with zero real matches, so this is deliberately more lenient
 * than findFuzzyMatch's in-text distance budget: there's nothing to lose
 * by suggesting a slightly looser match when the alternative is a dead
 * end. Compares the whole query against each candidate name's own whole
 * text and its same-length prefix (same truncated/extended-word idea as
 * findFuzzyMatch above), and returns the single closest name across the
 * whole catalog, or null if nothing is remotely close.
 */
export function suggestClosestName(query: string, names: string[]): string | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;

  const tolerance = Math.max(2, Math.ceil(trimmed.length * 0.45));

  let best: string | null = null;
  let bestDist = Infinity;

  for (const name of names) {
    const lower = name.toLowerCase();
    const whole = levenshtein(lower, trimmed);
    const prefix = lower.length > trimmed.length ? levenshtein(lower.slice(0, trimmed.length), trimmed) : whole;
    const dist = Math.min(whole, prefix);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }

  return bestDist <= tolerance ? best : null;
}
