const STEPS = [
  {
    number: "01",
    title: "Show your sign",
    text: "Use your webcam and perform an Indian Sign Language gesture.",
  },
  {
    number: "02",
    title: "Detect the hand",
    text: "MediaPipe detects the hand and extracts landmark coordinates.",
  },
  {
    number: "03",
    title: "Recognise the sign",
    text: "The recognition model analyses the hand features and predicts the sign.",
  },
  {
    number: "04",
    title: "Read or hear it",
    text: "The recognised sign is converted into readable text and speech.",
  },
];

export default function HowItWorks() {
  return (
    <section
      className="how-section section"
      id="how-it-works"
    >
      <div className="container">
        <div className="section-heading-center">
          <div className="section-label">
            How It Works
          </div>

          <h2 className="section-title">
            From sign to understanding
          </h2>

          <p className="section-subtitle">
            VOXA follows a simple computer-vision pipeline
            designed for real-time ISL recognition.
          </p>
        </div>

        <div className="steps-grid">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="step-card"
            >
              <span className="step-number">
                {step.number}
              </span>

              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>

        <div className="tech-flow">
          <span>Webcam</span>
          <strong>→</strong>
          <span>MediaPipe</span>
          <strong>→</strong>
          <span>Landmarks</span>
          <strong>→</strong>
          <span>ML Model</span>
          <strong>→</strong>
          <span>Text + Speech</span>
        </div>
      </div>
    </section>
  );
}