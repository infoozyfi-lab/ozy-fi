'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import type { RawOption, RawOptionGroup } from '@/lib/types';
import ConfirmDialog from './ConfirmDialog';
import { box, inputStyle, btn, btnPrimary, btnDanger } from './adminStyles';

// Per-product-size brief — "the part that most directly answers 'how do I
// change one pizza's Large price later'". Rendered directly on the product
// edit page (app/admin/products/[id]/edit/page.tsx), below the regular
// ResourceForm, so editing a pizza's size prices is a natural part of
// editing that pizza — no separate trip to the Option Groups tab and no
// need to know this product's internal option_groups id.
//
// Storage: the SAME option_groups/options rows the Option Groups admin tab
// and the storefront both already use (worker/migrations/
// 021_option_group_product_id.sql's product_id column, looked up by
// lib/menu-i18n.ts's normalizeMenuBlob). This component is purely about
// WHERE in the admin UI that data is exposed, reusing the generic
// /api/admin/option_groups and /api/admin/options CRUD endpoints rather
// than inventing a new storage mechanism or a dedicated API route.
//
// UI choice: each tier is edited as an ABSOLUTE price (what the customer
// actually pays for that size), converted to/from `price_delta` (stored
// relative to the product's own base price) only at the read/save
// boundary — an admin editing "this pizza's Large price" thinks in the
// final price, not in a delta from some other number.

interface Tier {
  id: string;
  label: string;
  // Kept as strings while being edited (mirrors ResourceForm's own
  // input-state convention) so a momentarily-empty or partially-typed
  // number field doesn't fight the input while the admin is still typing.
  label_fi: string;
  price: string;
  sort_order: number;
  saving: boolean;
  dirty: boolean;
}

function tierFromOption(opt: RawOption, basePrice: number): Tier {
  const delta = Number(opt.price_delta) || 0;
  return {
    id: opt.id,
    label: opt.label || '',
    label_fi: (opt.label_fi as string | null | undefined) || '',
    price: (basePrice + delta).toFixed(2),
    sort_order: Number((opt as Record<string, unknown>).sort_order) || 0,
    saving: false,
    dirty: false,
  };
}

export default function SizesEditor({ productId, productPrice }: { productId: string; productPrice: number }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Tier | null>(null);
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
      if (!groupsRes.ok || !optionsRes.ok) throw new Error('Could not load size tiers.');
      const groups = (await groupsRes.json().catch(() => [])) as RawOptionGroup[];
      const options = (await optionsRes.json().catch(() => [])) as RawOption[];
      // A product should have at most one 'size' group — see this
      // component's own header comment. If more than one somehow exists,
      // the first (lowest sort_order, same ordering the storefront uses)
      // is treated as authoritative rather than silently merging both.
      const group = (Array.isArray(groups) ? groups : [])
        .filter((g) => g.kind === 'size' && g.product_id === productId)
        .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))[0];
      setGroupId(group ? group.id : null);
      const groupOptions = group
        ? (Array.isArray(options) ? options : [])
            .filter((o) => o.group_id === group.id)
            .sort((a, b) => (Number((a as Record<string, unknown>).sort_order) || 0) - (Number((b as Record<string, unknown>).sort_order) || 0))
        : [];
      setTiers(groupOptions.map((o) => tierFromOption(o, productPrice)));
    } catch (err: any) {
      setError(err.message || 'Could not load size tiers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const updateTier = (id: string, patch: Partial<Tier>) => {
    setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch, dirty: true } : t)));
  };

  const saveTier = async (tier: Tier) => {
    setTiers((ts) => ts.map((t) => (t.id === tier.id ? { ...t, saving: true } : t)));
    setError('');
    try {
      const priceNum = Number(tier.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        throw new Error(`"${tier.label || tier.id}"'s price must be a number, 0 or more.`);
      }
      const res = await fetch(`/api/admin/options/${encodeURIComponent(tier.id)}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          label: tier.label,
          label_fi: tier.label_fi || null,
          // The one place price<->delta conversion happens — see this
          // file's header comment for why the admin edits an absolute
          // price rather than a delta directly.
          price_delta: Math.round((priceNum - productPrice) * 100) / 100,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Save failed.');
      }
      setTiers((ts) => ts.map((t) => (t.id === tier.id ? { ...t, saving: false, dirty: false } : t)));
    } catch (err: any) {
      setError(err.message || 'Save failed.');
      setTiers((ts) => ts.map((t) => (t.id === tier.id ? { ...t, saving: false } : t)));
    }
  };

  const addTier = async () => {
    setAddingGroup(true);
    setError('');
    try {
      let gid = groupId;
      if (!gid) {
        // First tier for this product — create its (product-scoped) 'size'
        // group too. `size-<productId>` can never collide with the fixed
        // global group ids ('base', 'sauce', ...) or another product's
        // group (also 'size-<that product's id>').
        gid = `size-${productId}`;
        const groupRes = await fetch('/api/admin/option_groups', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ id: gid, title: 'Size', kind: 'size', product_id: productId, sort_order: 0 }),
        });
        if (!groupRes.ok) {
          const data = (await groupRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Could not create this product’s size group.');
        }
        setGroupId(gid);
      }
      const nextSortOrder = tiers.length ? Math.max(...tiers.map((t) => t.sort_order)) + 1 : 0;
      const optRes = await fetch('/api/admin/options', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          group_id: gid,
          label: nextSortOrder === 0 ? 'Small' : 'New size',
          price_delta: 0,
          sort_order: nextSortOrder,
        }),
      });
      if (!optRes.ok) {
        const data = (await optRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not add a new tier.');
      }
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not add a new tier.');
    } finally {
      setAddingGroup(false);
    }
  };

  const confirmDeleteTier = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/options/${encodeURIComponent(pendingDelete.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed.');
      setPendingDelete(null);
      // A now-empty size group is left in place (harmless — normalizeMenuBlob
      // only ever reads it via its options, and an empty options list for a
      // 'size' group falls straight through to FALLBACK_OPTION, same as no
      // group at all) rather than auto-deleted, so re-adding a tier later
      // reuses the same group instead of silently creating a second one.
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
        <h2 style={{ margin: 0 }}>Sizes</h2>
        <button type="button" style={btnPrimary} disabled={addingGroup} onClick={addTier}>
          {addingGroup ? 'Adding…' : '+ Add size tier'}
        </button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        This product&apos;s own size tiers and prices. Only used by this product — editing a price here
        never affects any other product&apos;s sizes. If no tiers are added, this product shows no size
        selector at all and is sold at its regular price above.
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : tiers.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No size tiers yet — this product is sold at one price only.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiers.map((tier) => (
            <div key={tier.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: 10, borderRadius: 8, background: 'var(--bg-alt)' }}>
              <label style={{ flex: '1 1 160px', minWidth: 140 }}>
                Label (English)
                <input
                  style={inputStyle}
                  type="text"
                  value={tier.label}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateTier(tier.id, { label: e.target.value })}
                />
              </label>
              <label style={{ flex: '1 1 160px', minWidth: 140 }}>
                Label (Finnish, optional)
                <input
                  style={inputStyle}
                  type="text"
                  value={tier.label_fi}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateTier(tier.id, { label_fi: e.target.value })}
                />
              </label>
              <label style={{ width: 120 }}>
                Price (€)
                <input
                  style={inputStyle}
                  type="number" step="0.1" min="0"
                  value={tier.price}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateTier(tier.id, { price: e.target.value })}
                />
              </label>
              <button type="button" style={btnPrimary} disabled={tier.saving || !tier.dirty} onClick={() => saveTier(tier)}>
                {tier.saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" style={btnDanger} disabled={tier.saving} onClick={() => setPendingDelete(tier)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this size tier?"
        message={pendingDelete ? `Remove "${pendingDelete.label || pendingDelete.id}"? This cannot be undone.` : ''}
        confirmLabel="Remove"
        busy={deleting}
        onConfirm={confirmDeleteTier}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
