'use client';

// Horizontal ranked bar chart. Pass `color` (string) for a single-hue
// nominal series (e.g. best sellers — no legend needed, the chart title
// names it), or a `color` function/array indexed per row for a categorical
// breakdown (e.g. revenue by category) — row labels double as direct
// labels, so no separate legend box is needed either way.
export default function BarChart({ items, color, valueFormatter = (v) => v, emptyMessage = 'No data yet.' }) {
  if (!items || items.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '8px 0' }}>{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((it) => it.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => {
        const pct = Math.max(2, (it.value / max) * 100);
        const barColor = typeof color === 'function' ? color(i) : Array.isArray(color) ? color[i % color.length] : color;
        return (
          <div key={it.label + i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.label}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', flexShrink: 0 }}>{it.sublabel}</span>
              </div>
              <div
                title={it.title || `${it.label}: ${valueFormatter(it.value)}`}
                style={{ height: 10, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: barColor,
                    borderRadius: 999,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cream)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 56 }}>
              {valueFormatter(it.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
