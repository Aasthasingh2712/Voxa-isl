const PROBLEMS = [
  {
    num: "01",
    title: "Communication Gap",
    desc: "Many people do not understand ISL, which makes everyday communication difficult in places such as hospitals, classrooms and public offices.",
  },
  {
    num: "02",
    title: "Limited Accessibility",
    desc: "Most digital resources focus on learning sign language rather than translating signs during a live interaction.",
  },
  {
    num: "03",
    title: "Language Specificity",
    desc: "Indian Sign Language has its own vocabulary and grammar, so ASL-based recognition cannot simply be treated as an ISL solution.",
  },
  {
    num: "04",
    title: "Real-Time Recognition",
    desc: "A usable system must recognise gestures from a live camera while keeping prediction delay low.",
  },
];

export default function ProblemStatement() {
  return (
    <section
      className="section"
      id="problem"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.6fr",
            gap: "5rem",
            alignItems: "start",
          }}
          className="problem-layout"
        >
          <div>
            <div className="section-label">Problem</div>

            <h2 className="section-title">
              Why communication still becomes difficult
            </h2>

            <p
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.75,
                fontSize: "0.95rem",
              }}
            >
              A person may know exactly what they want to communicate, but the
              conversation can stop simply because the other person does not
              understand Indian Sign Language.
            </p>

            <div
              style={{
                marginTop: "2rem",
                padding: "1.25rem 1.5rem",
                background: "var(--bg-elevated)",
                borderLeft: "3px solid var(--accent)",
              }}
            >
              <p
                style={{
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  lineHeight: 1.65,
                  fontWeight: 500,
                }}
              >
                VOXA is intended to support communication around sign language,
                not replace sign language itself.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {PROBLEMS.map((problem) => (
              <div
                key={problem.num}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr",
                  gap: "1rem",
                  padding: "1.25rem",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: "var(--primary-muted)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    color: "var(--primary)",
                    fontWeight: 700,
                  }}
                >
                  {problem.num}
                </div>

                <div>
                  <h3
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "var(--text-primary)",
                      fontSize: "0.95rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {problem.title}
                  </h3>

                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {problem.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}