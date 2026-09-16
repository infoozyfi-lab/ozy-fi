'use client';

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { formatCurrency, formatNumber } from './colors';

interface AreaTrendDatum {
  day: string;
  revenue: number;
  orders: number;
}

interface AreaTrendPoint extends AreaTrendDatum {
  x: number;
  y: number;
}

// Single-series revenue trend: 2px line + ~10% opacity area wash, hairline
// gridlines, sparse date ticks, and a hover crosshair + tooltip (line/area
// charts always ship interaction, per the dataviz interaction spec).
export default function AreaTrendChart({ data, color = '#FF6A3D', height = 220 }: { data: AreaTrendDatum[]; color?: string; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 720; // viewBox units; scales responsively via CSS width:100%
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxRevenue = useMemo(() => Math.max(...data.map((d) => d.revenue), 1), [data]);
  const niceMax = useMemo(() => niceCeil(maxRevenue), [maxRevenue]);

  const points: AreaTrendPoint[] = useMemo(() => {
    const n = data.length;
    return data.map((d, i) => {
      const x = n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
      const y = padT + plotH - (d.revenue / niceMax) * plotH;
      return { x, y, ...d };
    });
  }, [data, niceMax, plotW, plotH]);

  const linePath = useMemo(() => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '), [points]);
  const areaPath = useMemo(() => {
    if (!points.length) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `M${first.x.toFixed(2)},${(padT + plotH).toFixed(2)} ${points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} L${last.x.toFixed(2)},${(padT + plotH).toFixed(2)} Z`;
  }, [points, plotH]);

  // Sparse x-axis ticks: first, last, and a few evenly spaced in between.
  const tickIdx = useMemo(() => {
    const n = points.length;
    if (n <= 6) return points.map((_, i) => i);
    const count = 6;
    const step = (n - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(i * step));
  }, [points]);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!wrapRef.current || points.length === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < best) { best = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const tooltipLeft = hover ? `${(hover.x / width) * 100}%` : '0%';
  const tooltipAlignEnd = hover && hover.x / width > 0.66;

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={wrapRef}
        style={{ position: 'relative', cursor: 'crosshair' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {gridLines.map((g) => {
            const y = padT + plotH - g * plotH;
            return (
              <g key={g}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
                <text x={padL} y={y - 4} fontSize="10" fill="var(--muted)">
                  {g === 0 ? '€0' : formatCompactAxis(niceMax * g)}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#revenueFill)" stroke="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 0} fill={color} stroke="var(--bg-card)" strokeWidth="2" />
          ))}

          {hover && (
            <>
              <line x1={hover.x} x2={hover.x} y1={padT} y2={padT + plotH} stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
              <circle cx={hover.x} cy={hover.y} r="5" fill={color} stroke="var(--bg-card)" strokeWidth="2" />
            </>
          )}

          {tickIdx.map((i) => {
            const p = points[i];
            if (!p) return null;
            return (
              <text key={i} x={p.x} y={height - 8} fontSize="10" fill="var(--muted)" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
                {formatDayLabel(p.day)}
              </text>
            );
          })}
        </svg>

        {hover && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: tooltipAlignEnd ? 'auto' : tooltipLeft,
              right: tooltipAlignEnd ? `${100 - (hover.x / width) * 100}%` : 'auto',
              transform: tooltipAlignEnd ? 'translateX(8px)' : 'translateX(8px)',
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--cream)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
              zIndex: 2,
            }}
          >
            <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{formatFullDate(hover.day)}</div>
            <div style={{ fontWeight: 700 }}>{formatCurrency(hover.revenue)}</div>
            <div style={{ color: 'var(--muted)' }}>{formatNumber(hover.orders)} order{hover.orders === 1 ? '' : 's'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  const residual = n / magnitude;
  let niceResidual = 10;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  return niceResidual * magnitude;
}

function formatCompactAxis(n: number): string {
  if (n >= 1000) return `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `€${Math.round(n)}`;
}

function formatDayLabel(dayStr: string): string {
  const d = new Date(`${dayStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayStr;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function formatFullDate(dayStr: string): string {
  const d = new Date(`${dayStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayStr;
  return d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
}
