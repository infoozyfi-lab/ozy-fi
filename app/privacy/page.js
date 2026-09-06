'use client';

import { useEffect } from 'react';
import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — ozy.fi';
  }, []);

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: 6 September 2026</p>

        <p>
          ozy.fi (&ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy. This
          page explains what personal data we collect when you order food
          through this website, why we collect it, and what rights you have
          under the EU General Data Protection Regulation (GDPR).
        </p>

        <h2>1. Who we are</h2>
        <p>
          ozy.fi<br />
          [Company name / Y-tunnus — fill in]<br />
          [Business address — fill in]<br />
          Email: hello@ozy.fi
        </p>

        <h2>2. What data we collect</h2>
        <p>When you place an order, we collect:</p>
        <ul>
          <li>Full name</li>
          <li>Delivery address</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Order contents and any notes you add (e.g. allergies, door code)</li>
        </ul>

        <h2>3. Why we collect it</h2>
        <ul>
          <li>To prepare and deliver your order</li>
          <li>To contact you about your order if needed</li>
          <li>To keep records required for accounting and tax purposes</li>
        </ul>
        <p>We do not sell your personal data to third parties.</p>

        <h2>4. How long we keep it</h2>
        <p>
          Order records are kept for as long as required by Finnish
          accounting law (currently 6 years), after which they are deleted.
        </p>

        <h2>5. Your rights</h2>
        <p>Under GDPR, you have the right to:</p>
        <ul>
          <li>Ask what personal data we hold about you</li>
          <li>Ask us to correct inaccurate data</li>
          <li>Ask us to delete your data, where legally possible</li>
          <li>Object to how your data is used</li>
        </ul>
        <p>To exercise any of these rights, email hello@ozy.fi.</p>

        <h2>6. Cookies</h2>
        <p>
          This site uses only the technical cookies/local storage needed to
          keep items in your cart while you order. It does not use
          advertising or tracking cookies.
        </p>

        <h2>7. Contact</h2>
        <p>Questions about this policy? Email hello@ozy.fi.</p>
      </main>
      <Footer />
    </StoreProvider>
  );
}
