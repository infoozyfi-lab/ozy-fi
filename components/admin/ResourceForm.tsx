'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { ResourceField } from '@/lib/types';
import { slugify } from '@/lib/slugify';
import { inputStyle, btn, btnPrimary } from './adminStyles';

// Bundle-slug-and-navigation brief, Task 2 — extracted out of
// components/admin/ResourceManager.tsx so the exact same field-rendering,
// validation, image-upload, ID-auto-slug, and save logic can be reused by
// BOTH ResourceManager's own inline "New"/"Edit" form AND the new
// dedicated standalone product-edit page
// (app/admin/products/[id]/edit/page.tsx), rather than that page
// rewriting an equivalent-looking form that could quietly drift out of
// sync. ResourceManager still owns the list/table/bulk-actions UI and
// simply renders this component for its own inline form — see this
// component's usage there.

type ResourceRow = Record<string, any>;
type ResourceFormState = Record<string, any>;

// Same priority list as before this extraction — see
// ResourceManager.tsx's own former comment (now here): products/addons
// use `name`, categories/option groups use `title`, individual options
// use `label` — no single key works for every table, so this is checked
// in order rather than assumed. A table with none of these three keys
// simply gets no auto-slug — typing `id` by hand keeps working.
const NAME_LIKE_KEYS = ['name', 'title', 'label'];

function findSlugSourceKey(fields: ResourceField[]): string | undefined {
  return NAME_LIKE_KEYS.find((key) => fields.some((f) => f.key === key));
}

function emptyForm(fields: ResourceField[]): ResourceFormState {
  const out: ResourceFormState = {};
  fields.forEach((f) => {
    if (f.type === 'checkbox') out[f.key] = f.default ?? false;
    else out[f.key] = f.default ?? '';
  });
  return out;
}

function rowToForm(row: ResourceRow, fields: ResourceField[]): ResourceFormState {
  const out: ResourceFormState = {};
  fields.forEach((f) => {
    const raw = row[f.key];
    if (f.type === 'checkbox') out[f.key] = Boolean(raw);
    else if (raw === null || raw === undefined) out[f.key] = '';
    else out[f.key] = String(raw);
  });
  return out;
}

// Downscales/re-encodes an image in the browser before it ever leaves the
// phone, so uploads are small and fast on mobile data. GIFs are left alone
// (canvas re-encoding would kill animation).
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  }
}

// Auto-SEO-filename hints — sent alongside the file to POST /api/admin/upload
// (see buildHintedSlug in app/api/admin/upload/route.ts), which prefers this
// text over the uploaded file's own name when building the storage key/URL.
function nameHintFor(form: ResourceFormState): string {
  if (typeof form.name === 'string' && form.name.trim()) return form.name.trim();
  if (typeof form.title === 'string' && form.title.trim()) return form.title.trim();
  return '';
}

function descriptionHintFor(form: ResourceFormState): string {
  return typeof form.description === 'string' ? form.description.trim() : '';
}

function formToBody(form: ResourceFormState, fields: ResourceField[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  fields.forEach((f) => {
    const val = form[f.key];
    if (f.type === 'checkbox') {
      body[f.key] = val ? 1 : 0;
    } else if (f.type === 'number') {
      body[f.key] = val === '' ? null : Number(val);
    } else {
      body[f.key] = val === '' ? null : val;
    }
  });
  return body;
}

interface ParentFilter {
  field: string;
  value: unknown;
}

export default function ResourceForm({
  table,
  fields,
  mode,
  initialRow,
  parentFilter,
  onSaved,
  onCancel,
}: {
  table: string;
  fields: ResourceField[];
  mode: 'new' | 'edit';
  initialRow?: ResourceRow;
  parentFilter?: ParentFilter;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ResourceFormState>(() => {
    if (mode === 'edit' && initialRow) return rowToForm(initialRow, fields);
    const empty = emptyForm(fields);
    // Pre-fill the parent reference (e.g. group_id) when this form was
    // opened by drilling into a specific option group — one less field
    // the admin has to remember to set correctly by hand.
    if (parentFilter) empty[parentFilter.field] = parentFilter.value;
    return empty;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  // Which field this table's live ID-from-name auto-fill should read
  // from, if any (see findSlugSourceKey above). `idTouched` tracks
  // whether the admin has typed into `id` themselves — once true,
  // auto-fill stops. Both only matter in `mode === 'new'`: in `edit`
  // mode the ID input is rendered disabled below, so its change handler
  // is never wired up at all.
  const slugSourceKey = findSlugSourceKey(fields);
  const [idTouched, setIdTouched] = useState(false);

  const jsonHeaders = { 'Content-Type': 'application/json' };

  const setField = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleTextFieldChange = (key: string, value: string) => {
    setField(key, value);
    if (mode !== 'new') return;
    if (key === 'id') {
      setIdTouched(true);
    } else if (!idTouched && slugSourceKey && key === slugSourceKey) {
      setField('id', slugify(value));
    }
  };

  const uploadImage = async (key: string, file: File, nameHint?: string, descriptionHint?: string) => {
    setUploading((u) => ({ ...u, [key]: true }));
    setError('');
    try {
      const processed = await compressImage(file);
      const body = new FormData();
      body.append('file', processed, file.name || 'upload.jpg');
      if (nameHint) body.append('nameHint', nameHint);
      if (descriptionHint) body.append('descriptionHint', descriptionHint);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setField(key, data.url);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = formToBody(form, fields);
      let res: Response;
      if (mode === 'new') {
        res = await fetch(`/api/admin/${table}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
      } else {
        const { id: _drop, ...rest } = body;
        const rowId = initialRow?.id;
        res = await fetch(`/api/admin/${table}/${encodeURIComponent(rowId)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(rest) });
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Save failed.');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)' }}>
      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {fields.map((f) => {
          if (f.key === 'id' && mode === 'edit') {
            return (
              <label key={f.key}>
                ID
                <input style={{ ...inputStyle, background: 'var(--bg)', color: 'var(--muted)' }} value={form.id} disabled />
              </label>
            );
          }
          if (f.type === 'select') {
            return (
              <label key={f.key}>
                {f.label}
                <select
                  style={inputStyle}
                  value={form[f.key]}
                  required={f.required}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setField(f.key, e.target.value)}
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            );
          }
          if (f.type === 'checkbox') {
            return (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 22 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={form[f.key]}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setField(f.key, e.target.checked)}
                  />
                  {f.label}
                </span>
                {f.hint && (
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{f.hint}</span>
                )}
              </label>
            );
          }
          if (f.type === 'image') {
            return (
              <label key={f.key} style={{ gridColumn: '1 / -1' }}>
                {f.label}
                {f.hint && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>
                    {f.hint}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {form[f.key] ? (
                    <img
                      src={form[f.key]}
                      alt={`${f.label} preview`}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', flexShrink: 0 }}
                    />
                  ) : null}
                  <input
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                    type="text"
                    placeholder="Upload below, or paste an image URL"
                    value={form[f.key]}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setField(f.key, e.target.value)}
                  />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  style={{ marginTop: 8, color: 'var(--cream)' }}
                  disabled={!!uploading[f.key]}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) {
                      uploadImage(f.key, file, nameHintFor(form), descriptionHintFor(form));
                    }
                    e.target.value = '';
                  }}
                />
                {uploading[f.key] && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Uploading…</p>
                )}
              </label>
            );
          }
          if (f.type === 'textarea') {
            return (
              <label key={f.key} style={{ gridColumn: '1 / -1' }}>
                {f.label}
                {f.hint && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>
                    {f.hint}
                  </span>
                )}
                <textarea
                  style={{ ...inputStyle, minHeight: 70 }}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              </label>
            );
          }
          // Only text/number fields reach here — every other `type`
          // returns its own JSX above.
          return (
            <label key={f.key}>
              {f.label}
              {f.hint && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>
                  {f.hint}
                </span>
              )}
              <input
                style={inputStyle}
                type={f.type === 'number' ? 'number' : 'text'}
                step={f.type === 'number' ? (f.step || 'any') : 'any'}
                required={f.required}
                value={form[f.key]}
                placeholder={f.placeholder || ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleTextFieldChange(f.key, e.target.value)}
              />
            </label>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <button type="submit" style={btnPrimary} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" style={btn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
