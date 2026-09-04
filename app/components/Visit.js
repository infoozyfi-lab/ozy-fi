export default function Visit() {
  return (
    <section className="visit" id="visit">
      <div className="wrap visit-grid">
        <div className="visit-block">
          <h3>Address</h3>
          <p>Esimerkkikatu 12<br />00100 Helsinki, Finland</p>
          <h3>Opening hours</h3>
          <div className="hours-row"><span>Mon – Thu</span><span>3pm – 10pm</span></div>
          <div className="hours-row"><span>Fri – Sat</span><span>3pm – 11pm</span></div>
          <div className="hours-row"><span>Sunday</span><span>2pm – 9pm</span></div>
          <h3 style={{ marginTop: 24 }}>Contact</h3>
          <p>hello@ozy.fi · 040 000 0000</p>
        </div>
        <div className="map-box"><div className="map-pin"></div></div>
      </div>
    </section>
  );
}
