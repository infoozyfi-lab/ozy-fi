'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import type { RawOption, RawOptionGroup } from '@/lib/types';
import ConfirmDialog from './ConfirmDialog';
import { box, inputStyle, btnPrimary, btnDanger } from './adminStyles';

// Option-gating-and-extras-system brief, Task 2 — the general "Extras"
// admin editor, deliberately built as SizesEditor.tsx's direct sibling:
// same shape of problem (per-product, admin-editable, label + price rows,
// stored as this SAME product's own option_groups/options rows via the
// SAME generic /api/admin/option_groups and /api/admin/options CRUD
// endpoints — reusing the storage/CRUD wiring rather than inventing a
// second mechanism, per that brief's own explicit instruction), with
// exactly the two differences the brief calls out:
//   1. Multi-select, not single-select — nothing here changes for THAT
//      (this component only manages the admin-side label+price rows; the
//      multi-select behavior lives in the customer-facing selection shape
//      — see lib/types.ts's Selection.extraIds/CartLineSelectionData.extraIds
//      and components/ProductPage.tsx's checkbox rendering).
//   2. No "synthesized base tier" concept — unlike SizesEditor, which
//      edits each tier as an ABSOLUTE price (converted to/from price_delta
//      against the product's own base price, since Normaali/the base size
//      IS the product's own price), an extra has no equivalent "this one
//      is already included" tier. Every extra here is edited directly as
//      its own price_delta — an extra's whole price IS its upcharge, there
//      is nothing to offset it against.
export default function ExtrasEditor({ productId }: { productId: string }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Extra | null>(null);
  const [deleting, setDeleting] = useState(false);

  const jsonHeaders = { 'Content-Type': 'application/json' };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsRes, optionsRes] = await Promise.all([
        fetch('/api/admin/option_groups'),
        fetch('/api/admin/options'),
      ]);
      if (!groupsRes.ok || !optionsRes.ok) throw new Error('Could not load extras.');
      const groups = (await groupsRes.json().catch(() => [])) as RawOptionGroup[];
      const options = (await optionsRes.json().catch(() => [])) as RawOption[];
      // A product should have at most one 'extra' group — same convention
      // as SizesEditor's own 'size' group lookup. If more than one somehow
      // exists, the first (lowest sort_order) is treated as authoritative.
      const group = (Array.isArray(groups) ? groups : [])
        .filter((g) => g.kind === 'extra' && g.product_id === productId)
        .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))[0];
      setGroupId(group ? group.id : null);
      const groupOptions = group
        ? (Array.isArray(options) ? options : [])
            .filter((o) => o.group_id === group.id)
            .sort((a, b) => (Number((a as Record<string, unknown>).sort_order) || 0) - (Number((b as Record<string, unknown>).sort_order) || 0))
        : [];
      setExtras(groupOptions.map(extraFromOption));
    } catch (err: any) {
      setError(err.message || 'Could not load extras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const updateExtra = (id: string, patch: Partial<Extra>) => {
    setExtras((es) => es.map((e) => (e.id === id ? { ...e, ...patch, dirty: true } : e)));
  };

  const saveExtra = async (extra: Extra) => {
    setExtras((es) => es.map((e) => (e.id === extra.id ? { ...e, saving: true } : e)));
    setError('');
    try {
      const priceNum = Number(extra.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        throw new Error(`"${extra.label || extra.id}"'s price must be a number, 0 or more.`);
      }
      const res = await fetch(`/api/admin/options/${encodeURIComponent(extra.id)}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          label: extra.label,
          label_fi: extra.label_fi || null,
          // No base-price offset here (see this file's header comment) —
          // the admin-entered price IS the price_delta, unlike SizesEditor's
          // price-minus-productPrice conversion.
          price_delta: Math.round(priceNum * 100) / 100,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Save failed (server returned ${res.status}).`);
      }
      setExtras((es) => es.map((e) => (e.id === extra.id ? { ...e, saving: false, dirty: false } : e)));
    } catch (err: any) {
      setError(err.message || 'Save failed.');
      setExtras((es) => es.map((e) => (e.id === extra.id ? { ...e, saving: false } : e)));
    }
  };

  const addExtra = async () => {
    setAdding(true);
    setError('');
    try {
      let gid = groupId;
      if (!gid) {
        // First extra for this product — create its (product-scoped)
        // 'extra' group too. `extra-<productId>` can never collide with
        // the fixed global group ids ('base', 'sauce', ...), another
        // product's extras group (also 'extra-<that product's id>'), or a
        // 'size' group (a different prefix, `size-<productId>`).
        gid = `extra-${productId}`;
        const groupRes = await fetch('/api/admin/option_groups', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ id: gid, title: 'Extras', kind: 'extra', product_id: productId, sort_order: 0 }),
        });
        if (!groupRes.ok) {
          const data = (await groupRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Could not create this product's extras group (server returned ${groupRes.status}).`);
        }
        setGroupId(gid);
      }
      const nextSortOrder = extras.length ? Math.max(...extras.map((e) => e.sort_order)) + 1 : 0;
      const optRes = await fetch('/api/admin/options', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          group_id: gid,
          label: 'New extra',
          price_delta: 0,
          sort_order: nextSortOrder,
        }),
      });
      if (!optRes.ok) {
        const data = (await optRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Could not add a new extra (server returned ${optRes.status}).`);
      }
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not add a new extra.');
    } finally {
      setAdding(false);
    }
  };

  const confirmDeleteExtra = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/options/${encodeURIComponent(pendingDelete.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Delete failed (server returned ${res.status}).`);
      }
      setPendingDelete(null);
      // A now-empty extras group is left in place (harmless — same
      // reasoning as SizesEditor's own "now-empty size group" comment:
      // normalizeMenuBlob only ever reads it via its options, and an empty
      // options list falls straight through to an empty extraOptions array)
      // rather than auto-deleted, so re-adding an extra later reuses the
      // same group instead of silently creating a second one.
      await load();
    } catch (err: any) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ ...box, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Extras</h2>
        <button type="button" style={btnPrimary} disabled={adding} onClick={addExtra}>
          {adding ? 'Adding…' : '+ Add extra'}
        </button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        This product&apos;s own extras — any named option with its own price (e.g. &quot;Double meat +4.00€&quot;,
        &quot;Extra sauce +1.50€&quot;). A customer can pick as many as they like — unlike Sizes above, these are
        not mutually exclusive. Only used by this product. If no extras are added, this product shows no extras
        section at all.
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : extras.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No extras yet — this product has no add-on options.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {extras.map((extra) => (
            <div key={extra.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: 10, borderRadius: 8, background: 'var(--bg-alt)' }}>
              <label style={{ flex: '1 1 160px', minWidth: 140 }}>
                Label (English)
                <input
                  style={inputStyle}
                  type="text"
                  value={extra.label}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateExtra(extra.id, { label: e.target.value })}
                />
              </label>
              <label style={{ flex: '1 1 160px', minWidth: 140 }}>
                Label (Finnish, optional)
                <input
                  style={inputStyle}
                  type="text"
                  value={extra.label_fi}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateExtra(extra.id, { label_fi: e.target.value })}
                />
              </label>
              <label style={{ width: 120 }}>
                Price (€)
                <input
                  style={inputStyle}
                  type="number" step="0.1" min="0"
                  value={extra.price}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateExtra(extra.id, { price: e.target.value })}
                />
              </label>
              <button type="button" style={btnPrimary} disabled={extra.saving || !extra.dirty} onClick={() => saveExtra(extra)}>
                {extra.saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" style={btnDanger} disabled={extra.saving} onClick={() => setPendingDelete(extra)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this extra?"
        message={pendingDelete ? `Remove "${pendingDelete.label || pendingDelete.id}"? This cannot be undone.` : ''}
        confirmLabel="Remove"
        busy={deleting}
        onConfirm={confirmDeleteExtra}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

interface Extra {
  id: string;
  label: string;
  // Kept as a string while being edited — same "don't fight a
  // momentarily-empty/partially-typed number field" reasoning as
  // SizesEditor.tsx's Tier.price.
  label_fi: string;
  price: string;
  sort_order: number;
  saving: boolean;
  dirty: boolean;
}

function extraFromOption(opt: RawOption): Extra {
  const delta = Number(opt.price_delta) || 0;
  return {
    id: opt.id,
    label: opt.label || '',
    label_fi: (opt.label_fi as string | null | undefined) || '',
    // No base-price offset (see this file's header comment) — the extra's
    // own price_delta IS its displayed/edited price.
    price: delta.toFixed(2),
    sort_order: Number((opt as Record<string, unknown>).sort_order) || 0,
    saving: false,
    dirty: false,
  };
}
