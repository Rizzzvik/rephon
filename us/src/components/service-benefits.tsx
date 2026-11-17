const benefits = [
  { icon: "◷", title: "Convenient service", detail: "Choose a service option that works for you." },
  { icon: "✦", title: "Device-specific help", detail: "Share the issue and get guidance on the next step." },
  { icon: "✓", title: "Clear service details", detail: "Understand the repair plan before work begins." },
  { icon: "⌘", title: "Flexible service routes", detail: "Check nearby and doorstep options for your area." },
];

export function ServiceBenefits() {
  return (
    <section className="service-benefits" aria-labelledby="service-benefits-title">
      <div className="service-benefits-heading"><p className="eyebrow">Thoughtful device care</p><h2 id="service-benefits-title">Why choose our services?</h2><p>Good support for the devices you rely on every day.</p></div>
      <div className="service-benefits-layout">
        <div className="repair-visual" aria-label="Illustration of a phone being repaired">
          <div className="repair-visual-glow" />
          <div className="repair-phone"><div className="repair-phone-screen"><span>W</span></div><i className="repair-camera" /></div>
          <div className="repair-divider"><span>✦</span></div>
          <span className="repair-label">CARE THAT CONNECTS</span>
        </div>
        <div className="service-benefit-list">
          {benefits.map((benefit) => <article className="service-benefit-card" key={benefit.title}>
            <span className="service-benefit-icon" aria-hidden="true">{benefit.icon}</span>
            <div><h3>{benefit.title}</h3><p>{benefit.detail}</p></div>
          </article>)}
        </div>
      </div>
    </section>
  );
}
