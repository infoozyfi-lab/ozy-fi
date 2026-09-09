'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';

export default function PopularNow() {
  const { products, popularProductIds } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();

  const picks = (popularProductIds || [])
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);

  if (picks.length === 0) return null;

  return (
    <div className="popular-now">
      <p className="eyebrow">{t.popularNow.eyebrow}</p>
      <div className="popular-grid">
        {picks.map((p) => (
          <Link key={p.id} href={lp(`/product/${p.id}`)} className="popular-card">
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
