import type { OrderStatus } from '@/lib/types';

// Chart color tokens for the OZY admin dashboard.
//
// Categorical set is the standard 8-hue order, originally validated with
// scripts/validate_palette.js against this app's OLD dark card surface
// (#241A13): all six checks passed (worst adjacent CVD ΔE 8.4, worst
// normal-vision ΔE 19.3, all >=3:1 contrast). Left untouched by the
// Cream & Terracotta palette swap — per the "adapted sensibly" /
// lighter-touch instruction for admin charts, and because reshuffling it
// is explicitly the one thing not to do (see below) — but that means
// it has NOT been re-validated against the new light card surface
// (#FFFFFF); re-running validate_palette.js against the new surface
// would be a good follow-up before leaning on this for anything
// contrast-critical. Order is the CVD-safety mechanism — never
// reshuffle it; a 9th category folds into "Other" instead of a new hue.
export const CATEGORICAL: string[] = [
  '#3987e5', // 1 blue
  '#d95926', // 2 orange
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
  '#d55181', // 5 magenta
  '#008300', // 6 green
  '#9085e9', // 7 violet
  '#e66767', // 8 red
];

// Brand accent — used for single-series charts (revenue trend, best sellers)
// where color's job is emphasis, not identity, so it stays on-brand instead
// of pulling from the categorical set.
export const BRAND = '#C14815'; // var(--ember-dark) -- chart marks sit directly on the light card, and the new brighter --ember only hits ~3.1:1 there, so this uses the text/chart-safe deep shade instead (matches the reasoning for every other place --ember was used AS a color against a light surface, not as a button fill)
// No longer literally var(--ember-dark) (that token moved to #C14815 with
// this swap — see BRAND above) — left at its old value on purpose, it's
// still a coherent dimmer/secondary tone in the same ember family and
// nothing here depends on it matching --ember-dark exactly.
export const BRAND_DIM = '#B24A26';
export const GOLD = '#7D5A16'; // var(--gold)

// Status palette — fixed, reserved meaning, always paired with a label.
// warning/serious darkened from the old dark-theme values (#fab219 /
// #ec835a) — both read fine as text/fills on a near-black card but drop
// well below AA contrast on the new light card background; good/critical
// already had adequate contrast on white and were left as-is.
export const STATUS: Record<'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'refund', string> = {
  good: '#0ca30c',
  warning: '#A66A00',
  serious: '#A8532E',
  critical: '#d03b3b',
  neutral: '#756B5F', // muted — "not started yet" (received)
  // Part C (admin-initiated refunds) — a genuinely new tone, not a reuse of
  // good (paid) or critical (failed): a refund isn't "bad" the way a failed
  // charge is, but it also isn't the ordinary "paid" success state, so it
  // gets its own identity. Pulled from CATEGORICAL[0] (#3987e5, blue) below
  // rather than inventing an unrelated hex, so it stays inside this file's
  // already-validated palette instead of adding an unvetted color.
  refund: '#3987e5',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  received: STATUS.neutral,
  preparing: STATUS.serious,
  on_the_way: STATUS.warning,
  delivered: STATUS.good,
  cancelled: STATUS.critical,
};

// Payment-status palette (Stripe card payments — worker/migrations/
// 012_stripe_payments.sql, orders.payment_status). A separate scale from
// ORDER_STATUS_COLOR above — order status and payment status are two
// different questions about an order — but reuses the same semantic tones
// (good/warning/critical/neutral) so "paid" and "failed" read as
// unambiguously positive/negative, consistent with every other such
// indicator in this admin panel.
export const PAYMENT_STATUS_COLOR = {
  cod: STATUS.neutral, // nothing to track — paid in person on delivery
  pending: STATUS.warning, // card order created, Stripe hasn't confirmed the charge yet
  paid: STATUS.good,
  failed: STATUS.critical,
  // Part C (admin-initiated refunds, worker/migrations/013_refunds.sql) —
  // both refund states share one tone (STATUS.refund); the pill's label
  // text is what tells "fully" and "partially" apart, same way "cod" and
  // "pending" already share no special distinction beyond their label.
  refunded: STATUS.refund,
  partially_refunded: STATUS.refund,
} as const;

export function categoryColor(index: number): string {
  if (index < CATEGORICAL.length) return CATEGORICAL[index];
  return '#6B5D50'; // "Other" — muted neutral, outside the categorical set on purpose
}

export function formatCurrency(n: unknown): string {
  const v = Number(n || 0);
  return `€${v.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Auto-compact formatting for big numbers in tight spaces (stat tile values).
export function formatCompactCurrency(n: unknown): string {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toLocaleString('en-IE', { maximumFractionDigits: 1 })}K`;
  return formatCurrency(v);
}

export function formatNumber(n: unknown): string {
  return Number(n || 0).toLocaleString('en-IE');
}

export function formatPercent(n: unknown, { signed = false }: { signed?: boolean } = {}): string {
  const v = Number(n || 0);
  const sign = signed && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

// Percent change from `prev` to `curr`; null when there's no meaningful
// baseline (avoids a misleading "+∞%" off a zero previous period).
export function percentChange(curr: unknown, prev: unknown): number | null {
  const c = Number(curr || 0);
  const p = Number(prev || 0);
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / p) * 100;
}
