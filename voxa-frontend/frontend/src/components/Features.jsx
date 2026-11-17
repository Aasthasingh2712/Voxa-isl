const FEATURES = [
  {
    title: "Real-time recognition",
    desc: "Capture ISL gestures directly through a standard webcam.",
  },
  {
    title: "Indian Sign Language",
    desc: "The project is designed specifically around ISL rather than ASL.",
  },
  {
    title: "Text output",
    desc: "Recognised gestures are converted into easy-to-read text.",
  },
  {
    title: "Speech output",
    desc: "Translations can be spoken aloud using browser speech synthesis.",
  },
];

export default function Features() {
  return (
    <section
      className="features-section section"
      id="features"
    >
      <div className="container">
        <div className="section-heading-center">
          <div className="section-label">
            Features
          </div>

          <h2 className="section-title">
            Built around practical communication
          </h2>
        </div>

        <div className="features-grid">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="feature-card"
            >
              <div className="feature-dot" />

              <h3>{feature.title}</h3>

              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}