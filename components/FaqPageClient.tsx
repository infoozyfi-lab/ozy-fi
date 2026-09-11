'use client';

import { useState } from 'react';
import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useTranslations } from '@/lib/i18n';

interface FaqItem {
  q: string;
  a: string;
}

function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid var(--line, #e5e5e5)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          padding: '18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, font: 'inherit', color: 'inherit',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '1.02rem' }}>{item.q}</span>
        <span aria-hidden="true" style={{ fontSize: '1.3rem', flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <p style={{ margin: '0 0 18px', color: 'var(--muted, #6b6b6b)', lineHeight: 1.6 }}>{item.a}</p>
      )}
    </div>
  );
}

export default function FaqPageClient() {
  const t = useTranslations();
  // Every question starts closed — an accordion (rather than showing all
  // 8 answers at once) keeps the page scannable, which matters here
  // specifically since this same visible text is also what's embedded in
  // the FAQPage schema (see app/(site)/[locale]/faq/page.tsx) for search
  // engines/AI answer boxes — the schema copy needs to exactly match
  // what a visitor can actually read on the page, open or not.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items: FaqItem[] = t.faq.items;

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>{t.faq.title}</h1>
        <p>{t.faq.intro}</p>

        <div style={{ marginTop: 24 }}>
          {items.map((item, i) => (
            <FaqRow
              key={item.q}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </main>
      <Footer />
    </StoreProvider>
  );
}
