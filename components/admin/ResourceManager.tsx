'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ResourceField } from '@/lib/types';
import ResourceForm from './ResourceForm';
import ConfirmDialog from './ConfirmDialog';
import { box, th, td, inputStyle, btn, btnPrimary, btnDanger } from './adminStyles';

type ResourceRow = Record<string, any>;

interface ParentFilter {
  field: string;
  value: unknown;
}

// No `token` prop: nothing in this component reads it anymore (its only
// past use was building Authorization headers, which are gone as of
// phase 5b — see jsonHeaders below), so it's dropped rather than kept as
// a no-op prop. If you're looking for auth, the httpOnly admin cookie is
// what every fetch() below actually relies on.
//
// Bundle-slug-and-navigation brief, Task 2 — the actual "New"/"Edit" form
// (field rendering, validation, image upload, ID auto-slug, save) now
// lives in the extracted components/admin/ResourceForm.tsx, reused both
// here (inline) and by the dedicated standalone product-edit page
// (app/admin/products/[id]/edit/page.tsx). This component keeps owning
// the list/table, bulk actions, duplicate, and per-row toggle/delete —
// none of which needed to move.
export default function ResourceManager({
  table,
  title,
  fields,
  displayCols,
  onChanged,
  parentFilter,
}: {
  table: string;
  title: string;
  fields: ResourceField[];
  displayCols?: string[];
  onChanged?: () => void;
  parentFilter?: ParentFilter;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null); // null = not editing, 'new' = creating
  // The actual row object ResourceForm should seed its fields from when
  // editingId is a real id — set explicitly by startEdit/duplicate rather
  // than looked up from `rows` at render time, because duplicate() needs
  // to open the freshly-created row for review immediately, before the
  // list reload it triggers has actually come back.
  const [editingRow, setEditingRow] = useState<ResourceRow | undefined>(undefined);
  // Audit-fixes brief, Part 6.7 — replaces the old window.confirm() gate
  // on remove() below; the row waiting on a Delete confirmation, or null
  // when the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<ResourceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk actions — only offered for tables with a price + active field
  // (products, addons); doesn't make sense for categories/options.
  const supportsBulk = fields.some((f) => f.key === 'price') && fields.some((f) => f.key === 'active');
  const categoryField = fields.find((f) => f.key === 'category_id');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPriceOp, setBulkPriceOp] = useState<'percent' | 'amount' | 'set'>('percent');
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
    setEditingRow(undefined);
    setEditingId('new');
  };

  const startEdit = (row: ResourceRow) => {
    setEditingRow(row);
    setEditingId(row.id);
  };

  // Bundle-slug-and-navigation brief, Task 2 — the reported bug ("saving/
  // navigating away drops the admin onto a different landing view, and
  // the back button doesn't return correctly") came from editing being
  // pure client-side state (editingId/form) with no history entry of its
  // own — a real Next.js route gets correct back-button/navigation
  // behavior for free, which is why products specifically now navigate
  // to a dedicated page instead of opening the inline form. Scoped to
  // products only for this delivery (see the report for why the other
  // four ResourceManager tables — categories/addons/options/option_groups
  // — keep their existing inline-edit behavior, which wasn't reported as
  // having this problem and is simpler/lower-traffic than product
  // editing). `router.replace` (not `push`) updates the CURRENT dashboard
  // history entry's URL to remember "Menu tab, Products sub-tab" *before*
  // navigating away — it doesn't add a new entry or remount this page, it
  // just means that when the admin later leaves the edit page (Cancel,
  // a successful save, or the literal browser/OS back button), whichever
  // of those they use lands back on this exact tab instead of the
  // dashboard's default tab.
  const editRow = (row: ResourceRow) => {
    if (table === 'products') {
      router.replace('/admin/dashboard?tab=menu&menuTab=products');
      router.push(`/admin/products/${encodeURIComponent(row.id)}/edit?returnTab=menu&returnMenuTab=products`);
      return;
    }
    startEdit(row);
  };

  const cancel = () => {
    setEditingId(null);
    setEditingRow(undefined);
  };

  // Audit-fixes brief, Part 6.7 — now just opens the confirm dialog; the
  // actual delete moved to confirmDelete below, run only once the admin
  // explicitly confirms in that dialog.
  const remove = (row: ResourceRow) => {
    setPendingDelete(row);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/${table}/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed.');
      load();
      if (onChanged) onChanged();
      setPendingDelete(null);
    } catch (err: any) {
      setError(err.message || 'Delete failed.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // One-tap "in stock" / "out of stock" toggle — no need to open the full
  // edit form just to hide something that's temporarily unavailable.
  const toggleActive = async (row: ResourceRow) => {
    try {
      const res = await fetch(`/api/admin/${table}/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ active: row.active ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('Update failed.');
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: row.active ? 0 : 1 } : r)));
      if (onChanged) onChanged();
    } catch (err: any) {
      setError(err.message || 'Update failed.');
    }
  };

  // Copies every field except id/name into a new row, so starting a
  // similar product doesn't mean re-typing everything from scratch.
  // Deliberately still opens the freshly-duplicated row in the inline
  // form (not the dedicated product-edit page) even for products — this
  // is a review-immediately-after-creating flow, not the "editing an
  // established resource" flow the reported navigation bug was about.
  const duplicate = async (row: ResourceRow) => {
    setError('');
    try {
      const body: Record<string, unknown> = {};
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
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Duplicate failed.');
      }
      const data = await res.json().catch(() => null);
      load();
      if (onChanged) onChanged();
      if (data) startEdit({ ...body, id: body.id });
    } catch (err: any) {
      setError(err.message || 'Duplicate failed.');
    }
  };

  const toggleSelected = (id: string) => {
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
  const applyBulkStock = async (makeActive: boolean) => {
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

      // Each item is checked individually server-side (e.g. products:
      // an offer price can't end up higher than the new regular price —
      // see app/api/admin/[table]/[id]/route.js). A bulk price DROP
      // can trigger this for any item whose existing offer price is now
      // higher than its new price, so this can't just assume every
      // request succeeded — each response is checked, and only the
      // ones that actually saved get reflected in the UI.
      const results = await Promise.all(
        updates.map(async (u) => {
          try {
            const res = await fetch(`/api/admin/${table}/${encodeURIComponent(u.id)}`, {
              method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ price: u.price }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              return { ...u, ok: false, error: data.error };
            }
            return { ...u, ok: true, error: undefined };
          } catch {
            return { ...u, ok: false, error: undefined };
          }
        })
      );

      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      setRows((rs) => rs.map((r) => {
        const u = succeeded.find((x) => x.id === r.id);
        return u ? { ...r, price: u.price } : r;
      }));

      if (failed.length === 0) {
        setBulkMsg(`Updated the price on ${succeeded.length} item${succeeded.length === 1 ? '' : 's'}.`);
      } else {
        const reason = failed[0].error ? ` (${failed[0].error})` : '';
        setBulkMsg(
          `Updated ${succeeded.length} item${succeeded.length === 1 ? '' : 's'}. `
          + `${failed.length} skipped${reason} — e.g. "${failed[0].id}". Check those individually.`
        );
      }
      setBulkPriceValue('');
      if (onChanged) onChanged();
    } catch {
      setBulkMsg('Some updates may have failed — check the list and try again.');
    } finally {
      setBulkBusy(false);
    }
  };

  const cols = displayCols || fields.map((f) => f.key).slice(0, 4);
  const visibleRows = parentFilter
    ? rows.filter((r) => r[parentFilter.field] === parentFilter.value)
    : categoryField && categoryFilter !== 'all'
      ? rows.filter((r) => r.category_id === categoryFilter)
      : rows;

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {categoryField && categoryField.type === 'select' && (
            <select style={{ ...inputStyle, width: 'auto', marginTop: 0, padding: '8px 10px' }} value={categoryFilter} onChange={(e: ChangeEvent<HTMLSelectElement>) => { setCategoryFilter(e.target.value); setSelectedIds(new Set()); }}>
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

              <select style={{ ...inputStyle, width: 'auto', marginTop: 0, padding: '8px 10px' }} value={bulkPriceOp} onChange={(e: ChangeEvent<HTMLSelectElement>) => setBulkPriceOp(e.target.value as 'percent' | 'amount' | 'set')}>
                <option value="percent">Adjust by %</option>
                <option value="amount">Adjust by €</option>
                <option value="set">Set price to €</option>
              </select>
              <input
                type="number" step="0.1" placeholder={bulkPriceOp === 'percent' ? 'e.g. 10 or -5' : 'e.g. 1.5'}
                style={{ ...inputStyle, width: 110, marginTop: 0, padding: '8px 10px' }}
                value={bulkPriceValue} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulkPriceValue(e.target.value)}
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
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
          {error}
        </div>
      )}

      {editingId !== null && (
        <>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'New' : `Edit "${editingId}"`}</h3>
          <ResourceForm
            key={editingId}
            table={table}
            fields={fields}
            mode={editingId === 'new' ? 'new' : 'edit'}
            initialRow={editingId === 'new' ? undefined : editingRow}
            parentFilter={parentFilter}
            onSaved={() => { cancel(); load(); if (onChanged) onChanged(); }}
            onCancel={cancel}
          />
        </>
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
                            background: row.active ? 'rgba(46,125,50,0.14)' : 'rgba(179,38,30,0.14)',
                            color: row.active ? 'var(--success)' : 'var(--danger)',
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
                    <button type="button" style={btn} onClick={() => editRow(row)}>Edit</button>
                    <button type="button" style={btn} onClick={() => duplicate(row)}>Duplicate</button>
                    <button type="button" style={btnDanger} onClick={() => remove(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this?"
        message={pendingDelete ? `Delete "${pendingDelete.id}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
