export default function About() {
  return (
    <section
      className="about-section section"
      id="about"
    >
      <div className="container">
        <div className="about-inner">
          <div>
            <div className="section-label">
              About VOXA
            </div>

            <h2 className="section-title">
              Making communication around ISL easier
            </h2>

            <p className="about-text">
              VOXA is an Indian Sign Language translation project
              built using computer vision, hand-landmark detection
              and machine learning.
            </p>

            <p className="about-text">
              The first version focuses on recognising selected ISL
              signs from a normal webcam and converting them into text
              and speech.
            </p>

            <p className="about-text">
              The architecture is intentionally kept modular so that
              dynamic signs, sentence recognition and improved
              deep-learning models can be added later.
            </p>
          </div>

          <div className="about-card">
            <div className="about-card-accent" />

            <blockquote>
              The aim is not to change how people sign.
              The aim is to help more people understand.
            </blockquote>

            <div className="tag-row">
              <Tag text="Computer Vision" />
              <Tag text="MediaPipe" />
              <Tag text="Machine Learning" />
              <Tag text="FastAPI" />
              <Tag text="React" />
              <Tag text="Text-to-Speech" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tag({ text }) {
  return (
    <span className="about-tag">
      {text}
    </span>
  );
}