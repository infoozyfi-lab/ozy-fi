import type { PublicSettings } from '@/lib/site-settings';

export interface HoursRow {
  label: string;
  value: string;
}

// SEO gap-fill, Part C — shared address/hours/contact block for the new
// /about, /contact and /pickup pages (not /delivery, which shows fee/
// minimum-order/postal-zone data instead — see DeliveryPageClient.tsx).
// Same "real data with a graceful placeholder for anything unset" model
// as components/Visit.tsx's formatHoursRows, just reading from
// admin_settings via lib/site-settings.ts instead of hardcoded copy.
// No 'use client' directive here — this is a plain presentational
// component with no hooks of its own, only ever rendered from inside an
// already-'use client' page wrapper (AboutPageClient.tsx etc.).
export default function PublicSettingsInfo({
  settings,
  hoursRows,
  t,
  show = {},
  headings = {},
}: {
  settings: PublicSettings;
  hoursRows: HoursRow[];
  t: any;
  show?: { address?: boolean; hours?: boolean; phone?: boolean; email?: boolean };
  // Page-specific heading text (e.g. the pickup page's "Pickup location"/
  // "Pickup hours" instead of the generic "Address"/"Opening hours") —
  // falls back to the same t.visit.* labels components/Visit.tsx uses.
  headings?: { address?: string; hours?: string };
}) {
  const showAddress = show.address !== false;
  const showHours = show.hours !== false;
  const showPhone = show.phone !== false;
  const showEmail = show.email !== false;

  return (
    <div className="visit-block">
      {showAddress && (
        <>
          <h3>{headings.address || t.visit.addressHeading}</h3>
          <p>{settings.address || t.visit.notSet}</p>
        </>
      )}
      {showHours && (
        <>
          <h3>{headings.hours || t.visit.openingHoursHeading}</h3>
          {hoursRows.map((r) => (
            <div className="hours-row" key={r.label}><span>{r.label}</span><span>{r.value}</span></div>
          ))}
        </>
      )}
      {(showPhone || showEmail) && (
        <>
          <h3 style={{ marginTop: 24 }}>{t.visit.contactHeading}</h3>
          {showEmail && (
            <p>{settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : t.visit.notSet}</p>
          )}
          {showPhone && (
            <p>{settings.phone ? <a href={`tel:${settings.phone.replace(/\s+/g, '')}`}>{settings.phone}</a> : t.visit.notSet}</p>
          )}
        </>
      )}
    </div>
  );
}
