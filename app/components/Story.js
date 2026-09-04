export default function Story() {
  return (
    <section className="story" id="story">
      <div className="wrap story-grid">
        <div className="story-figure">
          <img
            src="https://www.sourcesplash.com/i/random?q=pizza%20oven%20kitchen&w=700&h=875"
            alt="Fresh pizza coming out of the oven at ozy.fi"
            loading="lazy"
          />
        </div>
        <div className="story-text">
          <p>ozy.fi started with one oven, one recipe, and a refusal to cut corners on either.</p>
          <p>
            We make every order the same way, every time — fresh dough, hand-portioned toppings, a hot oven
            — plated the moment it&apos;s ready.
          </p>
          <p>No shortcuts, no frozen bases. Just good ingredients and a kitchen that never really cools down.</p>
          <div className="story-stats">
            <div><span className="num">100%</span><span className="lbl">Made to order</span></div>
            <div><span className="num">60+</span><span className="lbl">Items on the menu</span></div>
            <div><span className="num">7</span><span className="lbl">Days a week</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
