export default function Footer() {
  const scrollTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <a href="#top" className="logo" onClick={scrollTop}>ozy<span>.fi</span></a>
            <p style={{ color: 'var(--muted)', marginTop: 14, maxWidth: '32ch' }}>
              Pizza, kebab and burgers, made fresh.
            </p>
          </div>
          <div>
            <h4>Pages</h4>
            <a href="#menu" onClick={scrollTo('menu')}>Menu</a>
            <a href="#story" onClick={scrollTo('story')}>Our story</a>
            <a href="#visit" onClick={scrollTo('visit')}>Find us</a>
          </div>
          <div>
            <h4>Contact</h4>
            <a href="mailto:hello@ozy.fi">hello@ozy.fi</a>
            <a href="tel:0400000000">040 000 0000</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ozy.fi. All rights reserved.</span>
          <span>Demo website.</span>
        </div>
      </div>
    </footer>
  );
}
