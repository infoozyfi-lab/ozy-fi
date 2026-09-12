'use client';

// Growth features batch 2 (Feature 5) — admin management for scheduled
// weekday offers (e.g. a Monday/Tuesday slow-day discount, or a Friday
// special the business owner brands themselves). Managed through the
// SAME generic /api/admin/scheduled_offers[/:id] endpoints every other
// menu resource uses (lib/api-helpers.ts's ADMIN_TABLES) — this is a
// custom form/table component (not the shared <ResourceManager> renderer)
// only because day-checkboxes and a time-range/"all day" toggle aren't
// among ResourceField's existing types (text/number/select/checkbox/
// image/textarea) — same reasoning, and the same overall shape, as
// components/admin/BundleManager.tsx's custom slot-editor for `bundles`
// (also a JSON-in-TEXT column the generic renderer can't edit directly).
import { useEffect, useState, type CSSProperties, type FormEvent, type ChangeEvent } from 'react';
import type { RawScheduledOffer } from '@/lib/types';
import { DAY_KEYS, type DayKey } from '@/lib/scheduledOffers';

const box: CSSProperties = {
  background: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
  border: '1px solid var(--line)', marginBottom: '24px', color: 'var(--cream)',
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '10px', marginTop: '4px', boxSizing: 'border-box',
  border: '1px solid var(--line)', borderRadius: '8px', fontSize: 14,
  background: 'var(--bg-alt)', color: 'var(--cream)',
};
const btn: CSSProperties = {
  padding: '8px 14px', border: '1px solid var(--line)', borderRadius: '8px',
  background: 'var(--bg-alt)', color: 'var(--cream)', cursor: 'pointer', fontSize: 13, marginRight: 8,
};
const btnPrimary: CSSProperties = { ...btn, background: 'var(--ember)', color: '#1A0D06', border: 'none', fontWeight: 700 };
const btnDanger: CSSProperties = { ...btn, color: '#FF8A75', borderColor: '#5A2A1F' };
const th: CSSProperties = { textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--line)', fontSize: 13, color: 'var(--muted)' };
const td: CSSProperties = { padding: '10px', borderBottom: '1px solid var(--line)', fontSize: 14, color: 'var(--cream)' };

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

interface OfferFormState {
  id: string;
  label: string;
  days: DayKey[];
  allDay: boolean;
  start_time: string;
  end_time: string;
  discount_percent: string;
  active: boolean;
  sort_order: number | string;
}

function emptyOffer(): OfferFormState {
  return { id: '', label: '', days: [], allDay: true, start_time: '17:00', end_time: '21:00', discount_percent: '', active: true, sort_order: 0 };
}

function slugify(text: unknown): string {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function ScheduledOffersManager({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<RawScheduledOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferFormState>(emptyOffer());
  const [saving, setSaving] = useState(false);

  const jsonHeaders = { 'Content-Type': 'application/json' };

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/admin/scheduled_offers')
      .then((res) => res.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load scheduled offers.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => {
    setForm(emptyOffer());
    setEditingId('new');
  };

  const startEdit = (row: RawScheduledOffer) => {
    let days: DayKey[] = [];
    try {
      const parsed = JSON.parse(row.days || '[]');
      if (Array.isArray(parsed)) days = parsed.filter((d): d is DayKey => (DAY_KEYS as readonly string[]).includes(d));
    } catch {
      days = [];
    }
    const hasWindow = Boolean(row.start_time && row.end_time);
    setForm({
      id: row.id,
      label: row.label || '',
      days,
      allDay: !hasWindow,
      start_time: row.start_time || '17:00',
      end_time: row.end_time || '21:00',
      discount_percent: String(row.discount_percent ?? ''),
      active: row.active === undefined ? true : Boolean(row.active),
      sort_order: row.sort_order ?? 0,
    });
    setEditingId(row.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyOffer());
  };

  const setField = <K extends keyof OfferFormState>(key: K, value: OfferFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (day: DayKey) => setForm((f) => ({
    ...f,
    days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
  }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (form.days.length === 0) throw new Error('Select at least one day.');
      const pct = Number(form.discount_percent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error('Discount must be a percentage greater than 0 and at most 100.');

      const body: Record<string, unknown> = {
        id: form.id || `${slugify(form.label)}-${Date.now().toString(36).slice(-4)}`,
        label: form.label,
        days: JSON.stringify(form.days),
        start_time: form.allDay ? null : form.start_time,
        end_time: form.allDay ? null : form.end_time,
        discount_percent: pct,
        active: form.active ? 1 : 0,
        sort_order: Number(form.sort_order) || 0,
      };

      let res: Response;
      if (editingId === 'new') {
        res = await fetch('/api/admin/scheduled_offers', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
      } else {
        const { id: _drop, ...rest } = body;
        res = await fetch(`/api/admin/scheduled_offers/${encodeURIComponent(editingId as string)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(rest) });
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Save failed.');
      }
      cancel();
      load();
      if (onChanged) onChanged();
    } catch (err: any) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: RawScheduledOffer) => {
    if (!window.confirm(`Delete scheduled offer "${row.label}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/scheduled_offers/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed.');
      load();
      if (onChanged) onChanged();
    } catch (err: any) {
      setError(err.message || 'Delete failed.');
    }
  };

  const describeDays = (raw: string | undefined) => {
    try {
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed) || !parsed.length) return '—';
      return parsed.map((d: string) => DAY_LABELS[d as DayKey] || d).join(', ');
    } catch {
      return '—';
    }
  };

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Scheduled offers</h2>
        {editingId === null && (
          <button type="button" style={btnPrimary} onClick={startCreate}>+ Add new</button>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8 }}>
        A percentage discount that automatically applies at checkout on the day(s) and, optionally,
        the time window you pick below — e.g. a Monday/Tuesday slow-day boost, or your own Friday
        special. The label you enter here is shown to customers on the homepage and at checkout
        while the offer is live. Never stacks with a coupon code or the first-order discount — if
        more than one applies, whichever is most favorable to the customer wins.
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#3A1712', color: '#FF8A75', border: '1px solid #5A2A1F' }}>
          {error}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'New scheduled offer' : `Edit "${editingId}"`}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <label>
              Display label (shown to customers)
              <input style={inputStyle} required value={form.label} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('label', e.target.value)} placeholder="e.g. Monday Boost, Pizzaperjantai Special" />
            </label>
            <label>
              Discount (%)
              <input style={inputStyle} type="number" min="1" max="100" step="1" required value={form.discount_percent} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('discount_percent', e.target.value)} />
            </label>
            <label>
              Sort order
              <input style={inputStyle} type="number" value={form.sort_order} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('sort_order', e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={form.active} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('active', e.target.checked)} /> Active
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <span style={{ display: 'block', marginBottom: 6 }}>Active on</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', padding: 10, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)' }}>
              {DAY_KEYS.map((d) => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400 }}>
                  <input type="checkbox" checked={form.days.includes(d)} onChange={() => toggleDay(d)} />
                  {DAY_LABELS[d]}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.allDay} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('allDay', e.target.checked)} />
              All day (no time restriction on the selected day(s))
            </label>
            {!form.allDay && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginTop: 10 }}>
                <label>
                  Start time
                  <input style={inputStyle} type="time" value={form.start_time} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('start_time', e.target.value)} />
                </label>
                <label>
                  End time
                  <input style={inputStyle} type="time" value={form.end_time} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('end_time', e.target.value)} />
                </label>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save offer'}</button>
            <button type="button" style={btn} onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p>Loading…</p> : rows.length === 0 ? <p>No scheduled offers yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Label</th><th style={th}>Days</th><th style={th}>Window</th><th style={th}>Discount</th><th style={th}>Active</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{row.label}</td>
                  <td style={td}>{describeDays(row.days)}</td>
                  <td style={td}>{row.start_time && row.end_time ? `${row.start_time}–${row.end_time}` : 'All day'}</td>
                  <td style={td}>{Number(row.discount_percent)}%</td>
                  <td style={td}>{row.active ? 'Yes' : 'No'}</td>
                  <td style={td}>
                    <button type="button" style={btn} onClick={() => startEdit(row)}>Edit</button>
                    <button type="button" style={btnDanger} onClick={() => remove(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
