'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreContext';

export default function PopularNow() {
  const { products, popularProductIds } = useStore();

  const picks = (popularProductIds || [])
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);

  if (picks.length === 0) return null;

  return (
    <div className="popular-now">
      <p className="eyebrow">POPULAR RIGHT NOW</p>
      <div className="popular-grid">
        {picks.map((p) => (
          <Link key={p.id} href={`/product/${p.id}`} className="popular-card">
            <img src={p.image} alt={p.name} loading="lazy" />
            <span className="popular-card-info">
              <span className="popular-card-name">{p.name}</span>
              <span className="popular-card-price">{p.price.toFixed(2)} €</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
