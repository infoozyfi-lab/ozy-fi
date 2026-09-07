'use client';

const QUICK_CATEGORIES = [
  { id: 'pizzat', label: 'Pizza', icon: '🍕' },
  { id: 'kebab', label: 'Kebab', icon: '🥙' },
  { id: 'burgerit', label: 'Burgers', icon: '🍔' },
];

export default function Hero() {
  const goToCategory = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="hero">
      <div className="wrap">
        <p className="eyebrow">Pizza, kebab & burgers</p>
        <h1 className="hero-title display">
          Start your <em>order</em>
        </h1>
        <p className="hero-meta">
          <span className="stars">★ 4.8</span>
          <span>· 320+ reviews</span>
          <span className="sep">|</span>
          <span className="open">● Open now</span>
          <span className="sep">|</span>
          <span>25-35 min</span>
        </p>
        <p className="hero-sub">
          Fresh dough, made to order, always hot. Pick a category or browse the full menu —
          delivery or pickup at checkout.
        </p>
        <div className="hero-cats">
          {QUICK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="hero-cat"
              onClick={() => goToCategory(cat.id)}
            >
              <div className="hero-cat-icon">{cat.icon}</div>
              <div className="hero-cat-label">{cat.label}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
