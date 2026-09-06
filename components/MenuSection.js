'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/context/StoreContext';

const SCROLLSPY_OFFSET = 132;

export default function MenuSection() {
  const {
    openProduct,
    categories,
    products: items,
    menuLoading: loading,
    menuError: error,
  } = useStore();

  const tabRefs = useRef({});
  const sectionRefs = useRef({});
  const activeTabRef = useRef(null);

  useEffect(() => {
    if (categories.length > 0 && !activeTabRef.current) {
      activeTabRef.current = categories[0].id;
    }
  }, [categories]);

  const scrollToCat = (id) => {
    const el = sectionRefs.current[id];

    if (!el) return;

    const targetY =
      el.getBoundingClientRect().top +
      window.pageYOffset -
      SCROLLSPY_OFFSET;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });
  };

  const setActiveTab = (cat) => {
    if (activeTabRef.current === cat) return;

    const prev = tabRefs.current[activeTabRef.current];

    if (prev) {
      prev.classList.remove('active');
    }

    const next = tabRefs.current[cat];

    if (next) {
      next.classList.add('active');

      next.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'center',
      });
    }

    activeTabRef.current = cat;
  };

  useEffect(() => {
    if (!categories.length) return;

    let ticking = false;

    const update = () => {
      ticking = false;

      let active = categories[0].id;

      for (const cat of categories) {
        const el = sectionRefs.current[cat.id];

        if (!el) continue;

        if (
          el.getBoundingClientRect().top -
            SCROLLSPY_OFFSET <=
          0
        ) {
          active = cat.id;
        } else {
          break;
        }
      }

      setActiveTab(active);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, {
      passive: true,
    });

    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [categories]);

  if (loading) {
    return (
      <section id="menu">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Menu</p>
            <h2>Full menu</h2>
            <p>Loading menu...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="menu">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Menu</p>
            <h2>Full menu</h2>
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="menu">
      <div className="wrap">

        <div className="section-head">
          <p className="eyebrow">Menu</p>

          <h2>Full menu</h2>

          <p>
            Browse by category — pizzas, kebabs,
            burgers, salads and schnitzels, all made
            fresh. Tap an item to customize and add it
            to your order.
          </p>
        </div>

        <div className="cat-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              ref={(el) =>
                (tabRefs.current[cat.id] = el)
              }
              className={`cat-tab${
                cat.id === categories[0]?.id
                  ? ' active'
                  : ''
              }`}
              onClick={() => scrollToCat(cat.id)}
            >
              {cat.title}
            </button>
          ))}
        </div>

        {categories.map((cat) => (
          <div
            key={cat.id}
            className="menu-category"
            ref={(el) =>
              (sectionRefs.current[cat.id] = el)
            }
          >
            <h3 className="cat-title">
              {cat.title}
            </h3>

            <p className="cat-sub">
              {cat.sub}
            </p>

            {items
              .filter((item) => item.cat === cat.id)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="menu-item"
                  onClick={() => openProduct(item)}
                >
                  <span className="menu-item-info">

                    <span className="name-row">
                      <h3>{item.name}</h3>

                      {item.tag && (
                        <span className="tag">
                          {item.tag}
                        </span>
                      )}
                    </span>

                    {item.desc && (
                      <p className="desc">
                        {item.desc}
                      </p>
                    )}

                    <span className="price">
                      {item.price.toFixed(2)} €
                    </span>

                  </span>

                  <span className="menu-item-thumb">

                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                    />

                    <span
                      className="add-btn"
                      aria-hidden="true"
                    >
                      +
                    </span>

                  </span>
                </button>
              ))}
          </div>
        ))}

        <p className="menu-note">
          Extra toppings 2.50 €: 120 g patty, bacon,
          cheese, pineapple, blue cheese, onion, egg ·
          Condiments: ketchup, yogurt sauce, pickle,
          lemon juice, mayonnaise, American sauce,
          parsley, mint, chili flakes.
        </p>

      </div>
    </section>
  );
}
