'use client';

import { STATUS } from './colors';

// KPI stat tile: label + value + optional delta (vs a named prior period) +
// optional mini sparkline. Delta color = direction × whether up is good
// (defaults to "up is good"; pass goodDirection="down" for things like
// cancellations where a rise is bad).
export default function StatTile({ label, value, sublabel, delta, deltaLabel, goodDirection = 'up', sparkline, accent }) {
  let deltaColor = STATUS.neutral;
  let deltaText = null;
  if (delta !== null && delta !== undefined) {
    const isUp = delta > 0.05;
    const isDown = delta < -0.05;
    const isGood = goodDirection === 'up' ? isUp : isDown;
    const isBad = goodDirection === 'up' ? isDown : isUp;
    deltaColor = isGood ? STATUS.good : isBad ? STATUS.critical : STATUS.neutral;
    const arrow = isUp ? '↑' : isDown ? '↓' : '→';
    deltaText = `${arrow} ${Math.abs(delta).toFixed(1)}%`;
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {accent && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      )}
      <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600, letterSpacing: '0.01em' }}>{label}</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--cream)', lineHeight: 1.1, fontFamily: "'Work Sans', sans-serif" }}>
            {value}
          </div>
          {(sublabel || deltaText) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12.5 }}>
              {deltaText && <span style={{ color: deltaColor, fontWeight: 700 }}>{deltaText}</span>}
              {sublabel && <span style={{ color: 'var(--muted)' }}>{sublabel}</span>}
            </div>
          )}
          {!sublabel && deltaText && deltaLabel && (
            <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 2 }}>{deltaLabel}</div>
          )}
        </div>

        {sparkline && sparkline.length > 1 && (
          <MiniSparkline values={sparkline} color={accent || 'var(--ember)'} />
        )}
      </div>
    </div>
  );
}

function MiniSparkline({ values, color, width = 72, height = 32 }) {
  const max = Math.max(...values, 1);
  const barW = width / values.length;
  return (
    <svg width={width} height={height} style={{ flexShrink: 0, overflow: 'visible' }} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 2));
        const isLast = i === values.length - 1;
        return (
          <rect
            key={i}
            x={i * barW + 1}
            y={height - h}
            width={Math.max(2, barW - 2)}
            height={h}
            rx={1.5}
            fill={isLast ? color : 'var(--line)'}
            opacity={isLast ? 1 : 0.9}
          />
        );
      })}
    </svg>
  );
}
