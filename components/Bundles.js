'use client';

import { useStore } from '@/context/StoreContext';

export default function Bundles() {
  const { bundles, openBundle } = useStore();

  if (!bundles || bundles.length === 0) return null;

  return (
    <section className="menu-category wrap" id="bundles">
      <h3 className="cat-title">Combo deals</h3>
      {bundles.map((bundle) => (
        <button
          key={bundle.id}
          type="button"
          className="menu-item"
          onClick={() => openBundle(bundle)}
        >
          <span className="menu-item-info">
            <span className="name-row"><h3>{bundle.title}</h3></span>
            {bundle.description && <span className="desc">{bundle.description}</span>}
            <span className="price">{Number(bundle.price).toFixed(2)} €</span>
          </span>
          {bundle.image && (
            <span className="menu-item-thumb">
              <img src={bundle.image} alt={bundle.title} loading="lazy" />
            </span>
          )}
        </button>
      ))}
    </section>
  );
}
