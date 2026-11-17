import { formatTime } from "../utils/mockData";

export default function TranslationHistory({
  history,
  onSpeak,
  onClear,
}) {
  return (
    <section className="history-section" id="history">
      <div className="container">
        <div className="history-header">
          <div>
            <div className="section-label">Session Log</div>

            <h3
              className="font-display"
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Recent Translations
            </h3>
          </div>

          {history.length > 0 && (
            <button
              className="btn btn-danger btn-sm"
              onClick={onClear}
            >
              Clear History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="history-empty">
            No translations yet. Start the camera and capture a sign.
          </div>
        ) : (
          <div className="history-list">
            {history.map((entry) => (
              <div
                className="history-item"
                key={entry.id}
              >
                <span className="history-sign">
                  {entry.sign}
                </span>

                <span className="history-translation">
                  {entry.translation}
                </span>

                <span className="history-timestamp">
                  {formatTime(entry.timestamp)}
                </span>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    onSpeak(entry.translation)
                  }
                >
                  Speak
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}