'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ResourceForm from '@/components/admin/ResourceForm';
import SizesEditor from '@/components/admin/SizesEditor';
import ExtrasEditor from '@/components/admin/ExtrasEditor';
import { getProductFields } from '@/lib/admin-resource-fields';
import type { RawCategory, RawProduct, ResourceField } from '@/lib/types';

// Bundle-slug-and-navigation brief, Task 2 — dedicated product-edit route.
//
// The reported problem: editing a product happened in an in-place modal/
// inline form inside the admin dashboard's own client-side `tab`/
// `editingId` state, so saving or backing out of it had no real browser-
// history entry to return to — the mobile OS back gesture and the
// browser's own back button would skip right past it to wherever the
// dashboard was before it loaded at all, and there was no reliable way to
// land back on the exact tab/sub-tab the admin had been on. A real
// Next.js route (this page) gets correct back-button/navigation behavior
// for free, per this brief's own reasoning.
//
// This route follows the same conventions as the other standalone
// app/admin/* routes (e.g. app/admin/orders/[id]/invoice/page.tsx): a
// client component, its own /api/admin/me auth check (the API routes
// underneath already enforce this server-side regardless, but a real
// "please sign in" state is friendlier than a wall of failed fetches),
// English-only (this project's admin panel is deliberately not
// bilingual), and `useParams()`/`useSearchParams()` for its dynamic
// segment and query string.
//
// The actual form (fields, validation, image upload, ID handling, save)
// is NOT rewritten here — it's the same components/admin/ResourceForm.tsx
// component ResourceManager.tsx uses inline for every other resource,
// given the exact same field config (lib/admin-resource-fields.ts's
// getProductFields, the same function app/admin/dashboard/page.tsx's
// Products tab calls) so this page can never quietly drift out of sync
// with what the inline editor would have shown.

const page: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg, #F7F4EF)',
  padding: '24px 16px 60px',
  color: 'var(--cream)',
  fontFamily: "'Work Sans', sans-serif",
};

const backLink: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 13,
  textDecoration: 'none',
};

const card: CSSProperties = {
  maxWidth: 900,
  margin: '0 auto',
};

function EditProductPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  // Where "back to the list" should go — carried in this page's own URL
  // (set by components/admin/ResourceManager.tsx's Edit button) so this
  // page's own explicit Cancel/back link and its post-save redirect are
  // always correct regardless of how the admin arrived here, even from a
  // bookmarked or hand-typed URL that skipped the dashboard entirely.
  // Defaults to the Products tab, since that's the only thing this page
  // edits — see this feature's report for whether this pattern was
  // extended to any other resource type.
  const returnTab = searchParams.get('returnTab') || 'menu';
  const returnMenuTab = searchParams.get('returnMenuTab') || 'products';
  const returnUrl = `/admin/dashboard?tab=${encodeURIComponent(returnTab)}&menuTab=${encodeURIComponent(returnMenuTab)}`;

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState<RawCategory[]>([]);
  const [product, setProduct] = useState<RawProduct | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const meRes = await fetch('/api/admin/me');
        const me = (await meRes.json().catch(() => ({ authenticated: false }))) as { authenticated?: boolean };
        if (cancelled) return;
        if (!me.authenticated) {
          setAuthenticated(false);
          setChecking(false);
          return;
        }
        setAuthenticated(true);

        const [catsRes, prodsRes] = await Promise.all([
          fetch('/api/admin/categories'),
          fetch('/api/admin/products'),
        ]);
        if (cancelled) return;
        const cats = (await catsRes.json().catch(() => [])) as RawCategory[];
        const prods = (await prodsRes.json().catch(() => [])) as RawProduct[];
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : []);
        const found = Array.isArray(prods) ? prods.find((p) => p.id === id) : undefined;
        if (!found) {
          setNotFound(true);
        } else {
          setProduct(found);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    if (id) {
      load();
    } else {
      setNotFound(true);
      setChecking(false);
    }
    return () => { cancelled = true; };
  }, [id]);

  const fields: ResourceField[] = getProductFields(categories);

  if (checking) {
    return <main style={page}><div style={card}>Loading…</div></main>;
  }

  if (!authenticated) {
    return (
      <main style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>Please sign in to the admin panel to edit products.</p>
          <a href="/admin" style={{ color: 'var(--ember)' }}>Go to sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={card}>
        <div style={{ marginBottom: 16 }}>
          <Link href={returnUrl} style={backLink}>← Back to Products</Link>
        </div>

        {loadError && (
          <p style={{ color: 'var(--danger)' }}>Couldn&apos;t load this product. <Link href={returnUrl} style={{ color: 'var(--ember)' }}>Back to Products</Link></p>
        )}
        {notFound && !loadError && (
          <p style={{ color: 'var(--muted)' }}>This product doesn&apos;t exist (it may have been deleted). <Link href={returnUrl} style={{ color: 'var(--ember)' }}>Back to Products</Link></p>
        )}

        {product && (
          <>
            <h1 style={{ marginTop: 0 }}>Edit product — {product.name}</h1>
            <ResourceForm
              table="products"
              fields={fields}
              mode="edit"
              initialRow={product}
              onSaved={() => router.push(returnUrl)}
              onCancel={() => router.push(returnUrl)}
            />
            {/* Per-product-size brief — "the part that most directly
                answers 'how do I change one pizza's Large price later'".
                Rendered directly below the regular product form so editing
                this pizza's size tiers is part of editing this pizza,
                rather than a separate trip to the Option Groups tab.
                Non-pizza products (has_toppings off, or toppings on with
                no size group configured) render this with zero tiers,
                which is a normal, fully supported state — "add a tier"
                stays available so a product's size ladder can be
                introduced later without any code changes. */}
            <SizesEditor productId={product.id} productPrice={Number(product.price) || 0} />
            {/* Option-gating-and-extras-system brief, Task 2 — same
                reasoning as SizesEditor above: rendered directly below the
                regular product form (and below Sizes) so editing this
                product's extras is part of editing this product, not a
                separate trip anywhere else. Works for ANY product — a
                non-pizza item (kebab, burger, anything) is exactly the
                case this general "Extras" system was built for, unlike
                Sizes/toppings which stay pizza-builder-only. */}
            <ExtrasEditor productId={product.id} />
          </>
        )}
      </div>
    </main>
  );
}

export default function EditProductPage() {
  // useSearchParams() requires a Suspense boundary around whatever
  // component calls it — see app/admin/dashboard/page.tsx's identical
  // AdminDashboard/AdminDashboardView split for the same reason.
  return (
    <Suspense fallback={null}>
      <EditProductPageInner />
    </Suspense>
  );
}
