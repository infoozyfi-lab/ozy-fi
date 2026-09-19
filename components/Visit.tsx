'use client';

import { useStore } from '@/context/StoreContext';
import { useTranslations } from '@/lib/i18n';
import type { OpeningHours } from '@/lib/types';

function formatHoursRows(openingHours: OpeningHours, t: any) {
  if (!Array.isArray(openingHours)) return t.visit.fallbackRows;
  return openingHours.map((d) => ({
    label: t.visit.days[d.day] || d.day,
    value: d.closed ? t.visit.closed : `${d.open} – ${d.close}`,
  }));
}

export default function Visit() {
  // Audit-fixes brief, Part 6.4 — contactInfo (email/phone/address) now
  // comes from context/StoreContext.tsx the same way openingHours already
  // did (both ultimately sourced from admin_settings via /api/menu — see
  // that field's own comment on StoreContextValue). The address line used
  // to be a literal "Esimerkkikatu 12, 00100 Helsinki, Finland" — an
  // obviously fake placeholder address hardcoded straight into this
  // component, never read from anywhere real at all.
  const { openingHours, contactInfo } = useStore();
  const t = useTranslations();
  const rows = formatHoursRows(openingHours, t);

  return (
    <section className="visit" id="visit">
      <div className="wrap visit-grid">
        <div className="visit-block">
          <h3>{t.visit.addressHeading}</h3>
          <p>{contactInfo.address || t.visit.notSet}</p>
          <h3>{t.visit.openingHoursHeading}</h3>
          {rows.map((r: { label: string; value: string }) => (
            <div className="hours-row" key={r.label}><span>{r.label}</span><span>{r.value}</span></div>
          ))}
          <h3 style={{ marginTop: 24 }}>{t.visit.contactHeading}</h3>
          <p>
            {contactInfo.email ? <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a> : t.visit.notSet}
            {contactInfo.phone && (
              <>
                {' · '}
                <a href={`tel:${contactInfo.phone.replace(/\s+/g, '')}`}>{contactInfo.phone}</a>
              </>
            )}
          </p>
        </div>
        <div className="map-box"><div className="map-pin"></div></div>
      </div>
    </section>
  );
}
