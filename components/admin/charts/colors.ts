import type { OrderStatus } from '@/lib/types';

// Chart color tokens for the OZY admin dashboard.
//
// Categorical set is the standard 8-hue dark-mode order, validated with
// scripts/validate_palette.js against this app's card surface (#241A13):
// all six checks pass (worst adjacent CVD ΔE 8.4, worst normal-vision ΔE
// 19.3, all >=3:1 contrast). Order is the CVD-safety mechanism — never
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
export const BRAND = '#FF6A3D'; // var(--ember)
export const BRAND_DIM = '#C9542D'; // var(--ember-dim)
export const GOLD = '#E3A73B'; // var(--gold)

// Status palette — fixed, reserved meaning, always paired with a label.
export const STATUS: Record<'good' | 'warning' | 'serious' | 'critical' | 'neutral', string> = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  neutral: '#B8A99C', // muted — "not started yet" (received)
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  received: STATUS.neutral,
  preparing: STATUS.serious,
  on_the_way: STATUS.warning,
  delivered: STATUS.good,
  cancelled: STATUS.critical,
};

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
