export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-inner">
        <div className="animate-fade-up">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Indian Sign Language Translator
          </div>

          <h1 className="hero-title font-display">
            Speak with your hands.
            <br />
            <span className="hero-title-accent">
              We&apos;ll handle the rest.
            </span>
          </h1>

          <p className="hero-subtitle">
            VOXA uses computer vision to translate Indian Sign Language into
            text and speech through a simple webcam interface.
          </p>

          <div className="hero-actions">
            <a href="#translator" className="btn btn-primary btn-lg">
              Start Translating
            </a>

            <a href="#how-it-works" className="btn btn-outline btn-lg">
              How It Works
            </a>
          </div>

          <div className="hero-trust">
            <div className="trust-item">Real-time detection</div>
            <div className="trust-item">Text + Speech</div>
            <div className="trust-item">Designed for ISL</div>
          </div>
        </div>

        <div className="hero-visual animate-fade-up delay-200">
          <div className="hero-visual-frame">
            <div className="hero-visual-grid" />

            <div className="hero-visual-content">
              <HeroHandSVG />

              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  textAlign: "center",
                }}
              >
                Hand landmark preview

                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    color: "var(--accent)",
                    marginTop: "6px",
                  }}
                >
                  Camera → Landmarks → Translation
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroHandSVG() {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      className="hero-hand-icon"
    >
      <rect
        x="25"
        y="42"
        width="50"
        height="32"
        rx="10"
        fill="rgba(79,109,138,0.15)"
        stroke="rgba(79,109,138,0.5)"
        strokeWidth="1.5"
      />

      <rect
        x="28"
        y="22"
        width="10"
        height="24"
        rx="5"
        fill="rgba(79,109,138,0.2)"
      />
      <rect
        x="40"
        y="16"
        width="10"
        height="30"
        rx="5"
        fill="rgba(79,109,138,0.25)"
      />
      <rect
        x="52"
        y="18"
        width="10"
        height="28"
        rx="5"
        fill="rgba(79,109,138,0.2)"
      />
      <rect
        x="64"
        y="24"
        width="10"
        height="22"
        rx="5"
        fill="rgba(79,109,138,0.15)"
      />

      {[
        [33, 22],
        [45, 16],
        [57, 18],
        [69, 24],
        [33, 34],
        [45, 28],
        [57, 30],
        [69, 36],
        [33, 42],
        [45, 42],
        [57, 42],
        [69, 42],
        [50, 52],
      ].map(([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r="2.5"
          fill="var(--accent)"
        />
      ))}
    </svg>
  );
}