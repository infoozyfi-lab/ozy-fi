'use client';

import { useEffect, useState } from 'react';

const box = {
  background: '#fff',
  padding: '24px',
  borderRadius: '12px',
  border: '1px solid #ddd',
  marginBottom: '24px',
};

const th = { textAlign: 'left', padding: '10px', borderBottom: '2px solid #eee', fontSize: 13, color: '#666' };
const td = { padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: 14 };

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginTop: '4px',
  boxSizing: 'border-box',
  border: '1px solid #ccc',
  borderRadius: '8px',
  fontSize: 14,
};

const btn = {
  padding: '8px 14px',
  border: '1px solid #ccc',
  borderRadius: '8px',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  marginRight: 8,
};

const btnPrimary = { ...btn, background: '#111', color: '#fff', border: 'none' };
const btnDanger = { ...btn, color: '#b00020', borderColor: '#f0c0c0' };

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

export default function ResourceManager({ token, table, title, fields, displayCols, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = creating
  const [form, setForm] = useState(emptyForm(fields));
  const [saving, setSaving] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const load = () => {
    setLoading(true);
    setError('');
    fetch(`/api/admin/${table}`, { headers: { Authorization: `Bearer ${token}` } })
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
          headers: authHeaders,
          body: JSON.stringify(body),
        });
      } else {
        const { id: _drop, ...rest } = body;
        res = await fetch(`/api/admin/${table}/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: authHeaders,
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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed.');
      load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  const cols = displayCols || fields.map((f) => f.key).slice(0, 4);

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {editingId === null && (
          <button type="button" style={btnPrimary} onClick={startCreate}>
            + Add new
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#ffe5e5', color: '#b00020' }}>
          {error}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={submit} style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #eee' }}>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'New' : `Edit "${editingId}"`}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {fields.map((f) => {
              if (f.key === 'id' && editingId !== 'new') {
                return (
                  <label key={f.key}>
                    ID
                    <input style={{ ...inputStyle, background: '#eee' }} value={form.id} disabled />
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
      ) : rows.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {cols.map((c) => <th style={th} key={c}>{c}</th>)}
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {cols.map((c) => (
                    <td style={td} key={c}>
                      {typeof row[c] === 'number' && (c.includes('price') || c === 'price_delta')
                        ? `€${Number(row[c]).toFixed(2)}`
                        : String(row[c] ?? '')}
                    </td>
                  ))}
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
