'use client';

import { useEffect, useState } from 'react';

const box = {
  background: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
  border: '1px solid var(--line)', marginBottom: '24px', color: 'var(--cream)',
};
const inputStyle = {
  width: '100%', padding: '10px', marginTop: '4px', boxSizing: 'border-box',
  border: '1px solid var(--line)', borderRadius: '8px', fontSize: 14,
  background: 'var(--bg-alt)', color: 'var(--cream)',
};
const btn = {
  padding: '8px 14px', border: '1px solid var(--line)', borderRadius: '8px',
  background: 'var(--bg-alt)', color: 'var(--cream)', cursor: 'pointer', fontSize: 13, marginRight: 8,
};
const btnPrimary = { ...btn, background: 'var(--ember)', color: '#1A0D06', border: 'none', fontWeight: 700 };
const btnDanger = { ...btn, color: '#FF8A75', borderColor: '#5A2A1F' };
const th = { textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--line)', fontSize: 13, color: 'var(--muted)' };
const td = { padding: '10px', borderBottom: '1px solid var(--line)', fontSize: 14, color: 'var(--cream)' };

function emptyBundle() {
  return { id: '', title: '', description: '', image: '', price: '', active: true, sort_order: 0, slots: [] };
}

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function emptySlot(kind) {
  return kind === 'fixed'
    ? { kind: 'fixed', label: '', productId: '', qty: 1 }
    : { kind: 'choice', label: '', categoryId: '', qty: 1 };
}

export default function BundleManager({ token, categories, products, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBundle());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/admin/bundles', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load bundles.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const startCreate = () => {
    setForm(emptyBundle());
    setEditingId('new');
  };

  const startEdit = (row) => {
    let slots = [];
    try { slots = JSON.parse(row.slots || '[]'); } catch { slots = []; }
    setForm({
      id: row.id, title: row.title || '', description: row.description || '',
      image: row.image || '', price: String(row.price ?? ''), active: Boolean(row.active),
      sort_order: row.sort_order ?? 0, slots,
    });
    setEditingId(row.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyBundle());
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addSlot = (kind) => setForm((f) => ({ ...f, slots: [...f.slots, emptySlot(kind)] }));
  const removeSlot = (idx) => setForm((f) => ({ ...f, slots: f.slots.filter((_, i) => i !== idx) }));
  const setSlotField = (idx, key, value) => setForm((f) => ({
    ...f,
    slots: f.slots.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
  }));

  const uploadImage = async (file) => {
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file, file.name || 'upload.jpg');
      const res = await fetch('/api/admin/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setField('image', data.url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        id: form.id || `${slugify(form.title)}-${Date.now().toString(36).slice(-4)}`,
        title: form.title,
        description: form.description || null,
        image: form.image || null,
        price: form.price === '' ? 0 : Number(form.price),
        active: form.active ? 1 : 0,
        sort_order: Number(form.sort_order) || 0,
        slots: JSON.stringify(form.slots),
      };
      let res;
      if (editingId === 'new') {
        res = await fetch('/api/admin/bundles', { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
      } else {
        const { id: _drop, ...rest } = body;
        res = await fetch(`/api/admin/bundles/${encodeURIComponent(editingId)}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(rest) });
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
    if (!window.confirm(`Delete bundle "${row.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(row.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Delete failed.');
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Bundles / Combo deals</h2>
        {editingId === null && (
          <button type="button" style={btnPrimary} onClick={startCreate}>+ Add new</button>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8 }}>
        e.g. &quot;3 Pizza + 1.5L Lemonade — €45&quot;. A <strong>choice</strong> slot lets the
        customer pick + customize any product from a category (base price is already covered
        by the bundle price — only extra toppings/size/etc. add to the total). A{' '}
        <strong>fixed</strong> slot is included as-is.
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#3A1712', color: '#FF8A75', border: '1px solid #5A2A1F' }}>
          {error}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'New bundle' : `Edit "${editingId}"`}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {editingId !== 'new' ? (
              <label>ID<input style={{ ...inputStyle, background: 'var(--bg)', color: 'var(--muted)' }} value={form.id} disabled /></label>
            ) : (
              <label>ID (slug, optional — auto from title)<input style={inputStyle} value={form.id} onChange={(e) => setField('id', e.target.value)} placeholder="e.g. pizza-lemonade-combo" /></label>
            )}
            <label>Title<input style={inputStyle} required value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="3 Pizza + 1.5L Lemonade" /></label>
            <label>Price (€, flat combo price)<input style={inputStyle} type="number" step="0.1" required value={form.price} onChange={(e) => setField('price', e.target.value)} /></label>
            <label>Sort order<input style={inputStyle} type="number" value={form.sort_order} onChange={(e) => setField('sort_order', e.target.value)} /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} /> Active
            </label>
            <label style={{ gridColumn: '1 / -1' }}>Description<textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={(e) => setField('description', e.target.value)} /></label>
            <label style={{ gridColumn: '1 / -1' }}>
              Image
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                {form.image && <img src={form.image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />}
                <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={form.image} onChange={(e) => setField('image', e.target.value)} placeholder="Upload below, or paste an image URL" />
              </div>
              <input type="file" accept="image/*" style={{ marginTop: 8, color: 'var(--cream)' }} disabled={uploading} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) uploadImage(f); e.target.value = ''; }} />
              {uploading && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Uploading…</p>}
            </label>
          </div>

          <h4 style={{ marginBottom: 8 }}>Slots</h4>
          {form.slots.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No slots yet — add one below.</p>}

          {form.slots.map((slot, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: 12, marginBottom: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
              <label>
                Kind
                <select style={inputStyle} value={slot.kind} onChange={(e) => setSlotField(idx, 'kind', e.target.value)}>
                  <option value="choice">Choice (customer picks)</option>
                  <option value="fixed">Fixed (always included)</option>
                </select>
              </label>
              <label>
                Label
                <input style={inputStyle} value={slot.label} onChange={(e) => setSlotField(idx, 'label', e.target.value)} placeholder={slot.kind === 'fixed' ? 'Lemonade 1.5L' : 'Choose any Pizza'} />
              </label>
              {slot.kind === 'choice' ? (
                <label>
                  Category
                  <select style={inputStyle} value={slot.categoryId || ''} onChange={(e) => setSlotField(idx, 'categoryId', e.target.value)}>
                    <option value="">Select…</option>
                    {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
              ) : (
                <label>
                  Product
                  <select style={inputStyle} value={slot.productId || ''} onChange={(e) => setSlotField(idx, 'productId', e.target.value)}>
                    <option value="">Select…</option>
                    {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )}
              <label>
                Quantity
                <input style={inputStyle} type="number" min="1" value={slot.qty} onChange={(e) => setSlotField(idx, 'qty', Number(e.target.value) || 1)} />
              </label>
              <div style={{ alignSelf: 'end' }}>
                <button type="button" style={btnDanger} onClick={() => removeSlot(idx)}>Remove slot</button>
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <button type="button" style={btn} onClick={() => addSlot('choice')}>+ Add choice slot</button>
            <button type="button" style={btn} onClick={() => addSlot('fixed')}>+ Add fixed slot</button>
          </div>

          <div>
            <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save bundle'}</button>
            <button type="button" style={btn} onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p>Loading…</p> : rows.length === 0 ? <p>No bundles yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Title</th><th style={th}>Price</th><th style={th}>Slots</th><th style={th}>Active</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                let slotCount = 0;
                try { slotCount = JSON.parse(row.slots || '[]').length; } catch { slotCount = 0; }
                return (
                  <tr key={row.id}>
                    <td style={td}>{row.title}</td>
                    <td style={td}>€{Number(row.price).toFixed(2)}</td>
                    <td style={td}>{slotCount}</td>
                    <td style={td}>{row.active ? 'Yes' : 'No'}</td>
                    <td style={td}>
                      <button type="button" style={btn} onClick={() => startEdit(row)}>Edit</button>
                      <button type="button" style={btnDanger} onClick={() => remove(row)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
