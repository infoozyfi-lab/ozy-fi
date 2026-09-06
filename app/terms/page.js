'use client';

import { useEffect } from 'react';
import { StoreProvider } from '@/context/StoreContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms & Conditions — ozy.fi';
  }, []);

  return (
    <StoreProvider>
      <Header />
      <main className="wrap legal-page">
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-updated">Last updated: 6 September 2026</p>

        <h2>1. Orders</h2>
        <p>
          By placing an order on ozy.fi, you confirm the delivery details you
          provide (name, address, phone, email) are correct. We prepare your
          order once it is placed and cannot guarantee changes after
          submission — please call us if something needs correcting.
        </p>

        <h2>2. Prices &amp; payment</h2>
        <p>
          All prices are shown in euros (€) and include VAT where applicable.
          Payment is currently by cash on delivery only, paid directly to the
          delivery driver.
        </p>

        <h2>3. Delivery</h2>
        <p>
          Estimated delivery/ready times shown at checkout are approximate
          and may vary depending on order volume, weather, and traffic.
        </p>

        <h2>4. Allergies &amp; food information</h2>
        <p>
          Please note any allergies or dietary requirements in the
          &ldquo;Additional information&rdquo; field at checkout. While we
          take care with ingredients, our kitchen handles common allergens
          (gluten, dairy, nuts) and cannot guarantee an allergen-free
          environment.
        </p>

        <h2>5. Cancellations</h2>
        <p>
          To cancel or change an order, please call us as soon as possible.
          Once preparation has started, we may not be able to cancel.
        </p>

        <h2>6. Liability</h2>
        <p>
          ozy.fi is not liable for delays or issues caused by circumstances
          outside our reasonable control (e.g. severe weather, traffic
          disruption).
        </p>

        <h2>7. Contact</h2>
        <p>Questions about these terms? Email hello@ozy.fi.</p>
      </main>
      <Footer />
    </StoreProvider>
  );
}
