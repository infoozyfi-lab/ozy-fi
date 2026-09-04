export default function CtaStrip() {
  const goToMenu = (e) => {
    e.preventDefault();
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section className="cta-strip">
      <h2 className="display">Feeling hungry?</h2>
      <p>Order online for delivery or pickup — ready in under 30 minutes.</p>
      <a href="#menu" className="btn-primary" onClick={goToMenu}>Browse the menu</a>
    </section>
  );
}
