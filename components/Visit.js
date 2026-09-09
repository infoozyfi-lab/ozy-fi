'use client';

import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';

function formatHoursRows(openingHours, t) {
  if (!Array.isArray(openingHours)) return t.visit.fallbackRows;
  return openingHours.map((d) => ({
    label: t.visit.days[d.day] || d.day,
    value: d.closed ? t.visit.closed : `${d.open} – ${d.close}`,
  }));
}

export default function Visit() {
  const { openingHours } = useStore();
  const t = useTranslations();
  const rows = formatHoursRows(openingHours, t);

  return (
    <section className="visit" id="visit">
      <div className="wrap visit-grid">
        <div className="visit-block">
          <h3>{t.visit.addressHeading}</h3>
          <p>Esimerkkikatu 12<br />00100 Helsinki, Finland</p>
          <h3>{t.visit.openingHoursHeading}</h3>
          {rows.map((r) => (
            <div className="hours-row" key={r.label}><span>{r.label}</span><span>{r.value}</span></div>
          ))}
          <h3 style={{ marginTop: 24 }}>{t.visit.contactHeading}</h3>
          <p>hello@ozy.fi · 040 000 0000</p>
        </div>
        <div className="map-box"><div className="map-pin"></div></div>
      </div>
    </section>
  );
}
