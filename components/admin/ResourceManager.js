'use client';

import { useEffect, useState } from 'react';

const box = {
  background: 'var(--bg-card)',
  padding: '24px',
  borderRadius: '12px',
  border: '1px solid var(--line)',
  marginBottom: '24px',
  color: 'var(--cream)',
};

const th = { textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--line)', fontSize: 13, color: 'var(--muted)' };
const td = { padding: '10px', borderBottom: '1px solid var(--line)', fontSize: 14, color: 'var(--cream)' };

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginTop: '4px',
  boxSizing: 'border-box',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  fontSize: 14,
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
};

const btn = {
  padding: '8px 14px',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  background: 'var(--bg-alt)',
  color: 'var(--cream)',
  cursor: 'pointer',
  fontSize: 13,
  marginRight: 8,
};

const btnPrimary = { ...btn, background: 'var(--ember)', color: '#1A0D06', border: 'none', fontWeight: 700 };
const btnDanger = { ...btn, color: '#FF8A75', borderColor: '#5A2A1F' };

function emptyForm(fields) {
  const out = {};
  fields.forEach((f) => {
    if (f.type === 'checkbox') out[f.key] = f.default ?? false;
    else out[f.key] = f.default ?? '';
  });
  return out;
}

function rowToForm(row, fields) {
  const out = {};
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
async function compressImage(file, maxDim = 1600, quality = 0.82) {
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
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  }
}

function formToBody(form, fields) {
  const body = {};
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

// No `token` prop: nothing in this component reads it anymore (its only
// past use was building Authorization headers, which are gone as of
// phase 5b — see jsonHeaders below), so it's dropped rather than kept as
// a no-op prop. If you're looking for auth, the httpOnly admin cookie is
// what every fetch() below actually relies on.
export default function ResourceManager({ table, title, fields, displayCols, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = creating
  const [form, setForm] = useState(emptyForm(fields));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});

  // Bulk actions — only offered for tables with a price + active field
  // (products, addons); doesn't make sense for categories/options.
  const supportsBulk = fields.some((f) => f.key === 'price') && fields.some((f) => f.key === 'active');
  const categoryField = fields.find((f) => f.key === 'category_id');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPriceOp, setBulkPriceOp] = useState('percent'); // 'percent' | 'amount' | 'set'
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  // Phase 5b: no more Authorization header — the httpOnly admin cookie is
  // sent automatically on every same-origin fetch(), so this is just the
  // Content-Type needed for a JSON body (formerly named `authHeaders`).
  const jsonHeaders = { 'Content-Type': 'application/json' };

  const load = () => {
    setLoading(true);
    setError('');
    fetch(`/api/admin/${table}`)
      .then((res) => res.json())
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => setError('Could not load data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const startCreate = () => {
    setForm(emptyForm(fields));
    setEditingId('new');
  };

  const startEdit = (row) => {
    setForm(rowToForm(row, fields));
    setEditingId(row.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm(fields));
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const uploadImage = async (key, file) => {
    setUploading((u) => ({ ...u, [key]: true }));
    setError('');
    try {
      const processed = await compressImage(file);
      const body = new FormData();
      body.append('file', processed, file.name || 'upload.jpg');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setField(key, data.url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = formToBody(form, fields);
      let res;
      if (editingId === 'new') {
        res = await fetch(`/api/admin/${table}`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(body),
        });
      } else {
        const { id: _drop, ...rest } = body;
        res = await fetch(`/api/admin/${table}/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify(rest),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed.');
      }
      cancel();
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.id}"? This cannot be undone.`)) return;
    setError('');
    try {
      const res = await fetch(`/api/admin/${table}/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed.');
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  // One-tap "in stock" / "out of stock" toggle — no need to open the full
  // edit form just to hide something that's temporarily unavailable.
  const toggleActive = async (row) => {
    try {
      const res = await fetch(`/api/admin/${table}/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ active: row.active ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('Update failed.');
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: row.active ? 0 : 1 } : r)));
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Update failed.');
    }
  };

  // Copies every field except id/name into a new row, so starting a
  // similar product doesn't mean re-typing everything from scratch.
  const duplicate = async (row) => {
    setError('');
    try {
      const body = {};
      fields.forEach((f) => {
        if (f.key === 'id') return;
        body[f.key] = f.key === 'name' ? `${row.name} (copy)` : row[f.key];
      });
      body.id = `${row.id}-copy-${Date.now().toString(36)}`;
      const res = await fetch(`/api/admin/${table}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Duplicate failed.');
      }
      const data = await res.json().catch(() => null);
      load();
      if (onChanged) onChanged();
      if (data) startEdit({ ...body, id: body.id });
    } catch (err) {
      setError(err.message || 'Duplicate failed.');
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (selectedIds.size === visibleRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleRows.map((r) => r.id)));
    }
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkMsg('');
  };

  // Reuses the same single-item PUT endpoint per selected row — simplest
  // reliable approach without a dedicated bulk API, and fast enough for
  // a menu-sized list (tens of items, not thousands).
  const applyBulkStock = async (makeActive) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMsg('');
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          fetch(`/api/admin/${table}/${encodeURIComponent(id)}`, {
            method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ active: makeActive ? 1 : 0 }),
          })
        )
      );
      setRows((rs) => rs.map((r) => (selectedIds.has(r.id) ? { ...r, active: makeActive ? 1 : 0 } : r)));
      setBulkMsg(`Updated ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}.`);
      if (onChanged) onChanged();
    } catch {
      setBulkMsg('Some updates may have failed — check the list and try again.');
    } finally {
      setBulkBusy(false);
    }
  };

  const applyBulkPrice = async () => {
    const num = Number(bulkPriceValue);
    if (selectedIds.size === 0 || !Number.isFinite(num)) return;
    setBulkBusy(true);
    setBulkMsg('');
    try {
      const targets = rows.filter((r) => selectedIds.has(r.id));
      const updates = targets.map((r) => {
        const current = Number(r.price) || 0;
        let next = current;
        if (bulkPriceOp === 'percent') next = current * (1 + num / 100);
        else if (bulkPriceOp === 'amount') next = current + num;
        else if (bulkPriceOp === 'set') next = num;
        next = Math.max(0, Math.round(next * 100) / 100);
        return { id: r.id, price: next };
      });
      await Promise.all(
        updates.map((u) =>
          fetch(`/api/admin/${table}/${encodeURIComponent(u.id)}`, {
            method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ price: u.price }),
          })
        )
      );
      setRows((rs) => rs.map((r) => {
        const u = updates.find((x) => x.id === r.id);
        return u ? { ...r, price: u.price } : r;
      }));
      setBulkMsg(`Updated the price on ${updates.length} item${updates.length === 1 ? '' : 's'}.`);
      setBulkPriceValue('');
      if (onChanged) onChanged();
    } catch {
      setBulkMsg('Some updates may have failed — check the list and try again.');
    } finally {
      setBulkBusy(false);
    }
  };

  const cols = displayCols || fields.map((f) => f.key).slice(0, 4);
  const visibleRows = categoryField && categoryFilter !== 'all' ? rows.filter((r) => r.category_id === categoryFilter) : rows;

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {categoryField && (
            <select style={{ ...inputStyle, width: 'auto', marginTop: 0, padding: '8px 10px' }} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSelectedIds(new Set()); }}>
              <option value="all">All categories</option>
              {(categoryField.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {supportsBulk && (
            <button type="button" style={bulkMode ? btnPrimary : btn} onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}>
              {bulkMode ? 'Done selecting' : 'Select multiple'}
            </button>
          )}
          {editingId === null && !bulkMode && (
            <button type="button" style={btnPrimary} onClick={startCreate}>
              + Add new
            </button>
          )}
        </div>
      </div>

      {bulkMode && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: 'var(--bg-alt)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={selectedIds.size === visibleRows.length && visibleRows.length > 0} onChange={selectAllVisible} />
              {selectedIds.size} of {visibleRows.length} selected
            </label>
          </div>

          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button type="button" style={btn} disabled={bulkBusy} onClick={() => applyBulkStock(true)}>Mark in stock</button>
              <button type="button" style={btn} disabled={bulkBusy} onClick={() => applyBulkStock(false)}>Mark out of stock</button>

              <span style={{ color: 'var(--line)' }}>|</span>

              <select style={{ ...inputStyle, width: 'auto', marginTop: 0, padding: '8px 10px' }} value={bulkPriceOp} onChange={(e) => setBulkPriceOp(e.target.value)}>
                <option value="percent">Adjust by %</option>
                <option value="amount">Adjust by €</option>
                <option value="set">Set price to €</option>
              </select>
              <input
                type="number" step="0.1" placeholder={bulkPriceOp === 'percent' ? 'e.g. 10 or -5' : 'e.g. 1.5'}
                style={{ ...inputStyle, width: 110, marginTop: 0, padding: '8px 10px' }}
                value={bulkPriceValue} onChange={(e) => setBulkPriceValue(e.target.value)}
              />
              <button type="button" style={btnPrimary} disabled={bulkBusy || bulkPriceValue === ''} onClick={applyBulkPrice}>
                {bulkBusy ? 'Applying…' : 'Apply price change'}
              </button>
            </div>
          )}
          {bulkMsg && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--gold)' }}>{bulkMsg}</p>}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#3A1712', color: '#FF8A75', border: '1px solid #5A2A1F' }}>
          {error}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'New' : `Edit "${editingId}"`}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {fields.map((f) => {
              if (f.key === 'id' && editingId !== 'new') {
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
                      onChange={(e) => setField(f.key, e.target.value)}
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
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                    <input
                      type="checkbox"
                      checked={form[f.key]}
                      onChange={(e) => setField(f.key, e.target.checked)}
                    />
                    {f.label}
                  </label>
                );
              }
              if (f.type === 'image') {
                return (
                  <label key={f.key} style={{ gridColumn: '1 / -1' }}>
                    {f.label}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      {form[f.key] ? (
                        <img
                          src={form[f.key]}
                          alt=""
                          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', flexShrink: 0 }}
                        />
                      ) : null}
                      <input
                        style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                        type="text"
                        placeholder="Upload below, or paste an image URL"
                        value={form[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)}
                      />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ marginTop: 8, color: 'var(--cream)' }}
                      disabled={!!uploading[f.key]}
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (file) uploadImage(f.key, file);
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
                    <textarea
                      style={{ ...inputStyle, minHeight: 70 }}
                      value={form[f.key]}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  </label>
                );
              }
              return (
                <label key={f.key}>
                  {f.label}
                  <input
                    style={inputStyle}
                    type={f.type === 'number' ? 'number' : 'text'}
                    step={f.step || 'any'}
                    required={f.required}
                    value={form[f.key]}
                    placeholder={f.placeholder || ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </label>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="submit" style={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" style={btn} onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : visibleRows.length === 0 ? (
        <p>{categoryFilter !== 'all' ? 'No entries in this category.' : 'No entries yet.'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {bulkMode && <th style={th}></th>}
                {cols.map((c) => <th style={th} key={c}>{c}</th>)}
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {bulkMode && (
                    <td style={td}>
                      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} />
                    </td>
                  )}
                  {cols.map((c) => (
                    <td style={td} key={c}>
                      {c === 'active' ? (
                        <button
                          type="button"
                          onClick={() => toggleActive(row)}
                          style={{
                            border: 'none', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            background: row.active ? 'rgba(124,184,106,0.18)' : 'rgba(255,106,92,0.18)',
                            color: row.active ? '#7CB86A' : '#FF6A5C',
                          }}
                        >
                          {row.active ? 'In stock' : 'Out of stock'}
                        </button>
                      ) : typeof row[c] === 'number' && (c.includes('price') || c === 'price_delta')
                        ? `€${Number(row[c]).toFixed(2)}`
                        : String(row[c] ?? '')}
                    </td>
                  ))}
                  <td style={td}>
                    <button type="button" style={btn} onClick={() => startEdit(row)}>Edit</button>
                    <button type="button" style={btn} onClick={() => duplicate(row)}>Duplicate</button>
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
