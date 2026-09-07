'use client';

// Vertical column chart for a fixed, ordered x-axis (hour of day). Order
// carries meaning here, so columns are never re-sorted by value; color is a
// single brand hue since there's only one series.
export default function ColumnChart({ data, color = '#FF6A3D', height = 120, labelEvery = 4 }) {
  if (!data || data.every((d) => d.value === 0)) {
    return <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '8px 0' }}>No orders yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * (height - 4));
          return (
            <div
              key={i}
              title={`${d.label}: ${d.value} order${d.value === 1 ? '' : 's'}`}
              style={{
                flex: 1,
                height: h,
                background: d.value === 0 ? 'var(--line)' : color,
                borderRadius: '3px 3px 0 0',
                minWidth: 2,
                transition: 'height 0.3s ease',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: 'var(--muted)' }}>
            {i % labelEvery === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
