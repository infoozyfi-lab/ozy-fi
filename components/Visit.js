'use client';

import { useStore } from '@/context/StoreContext';

const DAY_LABELS = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

// Used only until the real per-day hours load (or if the restaurant
// hasn't set structured hours yet at all) — same placeholder text this
// section always showed before Phase 7.7's admin editor existed.
const FALLBACK_ROWS = [
  { label: 'Mon – Thu', value: '3pm – 10pm' },
  { label: 'Fri – Sat', value: '3pm – 11pm' },
  { label: 'Sunday', value: '2pm – 9pm' },
];

function formatHoursRows(openingHours) {
  if (!Array.isArray(openingHours)) return FALLBACK_ROWS;
  return openingHours.map((d) => ({
    label: DAY_LABELS[d.day] || d.day,
    value: d.closed ? 'Closed' : `${d.open} – ${d.close}`,
  }));
}

export default function Visit() {
  const { openingHours } = useStore();
  const rows = formatHoursRows(openingHours);

  return (
    <section className="visit" id="visit">
      <div className="wrap visit-grid">
        <div className="visit-block">
          <h3>Address</h3>
          <p>Esimerkkikatu 12<br />00100 Helsinki, Finland</p>
          <h3>Opening hours</h3>
          {rows.map((r) => (
            <div className="hours-row" key={r.label}><span>{r.label}</span><span>{r.value}</span></div>
          ))}
          <h3 style={{ marginTop: 24 }}>Contact</h3>
          <p>hello@ozy.fi · 040 000 0000</p>
        </div>
        <div className="map-box"><div className="map-pin"></div></div>
      </div>
    </section>
  );
}
