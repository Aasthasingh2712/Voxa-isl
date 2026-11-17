const STATS = [
  {
    value: "5.07M",
    label: "People recorded with hearing disability",
    source: "Census of India 2011",
  },
  {
    value: "18.9%",
    label: "Share of India's disabled population",
    source: "Hearing disability category",
  },
  {
    value: "10K+",
    label: "Terms in the ISL dictionary",
    source: "ISLRTC",
  },
];

export default function ISLStats() {
  return (
    <section className="section" id="isl-stats">
      <div className="container">
        <div
          style={{
            textAlign: "center",
            marginBottom: "3rem",
          }}
        >
          <div className="section-label">Context</div>

          <h2 className="section-title" style={{ margin: "0 auto" }}>
            Why ISL accessibility matters
          </h2>

          <p
            className="section-subtitle"
            style={{ margin: "0 auto", textAlign: "center" }}
          >
            Indian Sign Language is a complete language, yet communication
            barriers remain common when an ISL user interacts with a
            non-signer.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1.25rem",
          }}
          className="stats-grid"
        >
          {STATS.map((stat) => (
            <div
              key={stat.value}
              className="card"
              style={{ padding: "1.75rem" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2.4rem",
                  fontWeight: 800,
                  color: "var(--primary)",
                  marginBottom: "0.5rem",
                }}
              >
                {stat.value}
              </div>

              <div
                style={{
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  marginBottom: "0.3rem",
                }}
              >
                {stat.label}
              </div>

              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                }}
              >
                {stat.source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}