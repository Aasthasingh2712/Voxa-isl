import { useState } from "react";

export default function TranslationResult({
  result,
  isTranslating,
  onSpeak,
  onClear,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(
      result.translation
    );

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  return (
    <div className="card result-card">
      <div className="result-card-header">
        <span
          className="font-display"
          style={{
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          Translation Output
        </span>

        {result && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>

      <div className="result-detected-area">
        <div className="result-section-label">
          Detected Sign
        </div>

        {isTranslating && !result ? (
          <div className="result-processing">
            <TranslatingSpinner />
            <span>Analyzing gesture...</span>
          </div>
        ) : result ? (
          <>
            <div className="result-detected-sign font-display">
              {result.sign}
            </div>

            <div className="result-confidence">
              <div className="confidence-bar-track">
                <div
                  className="confidence-bar-fill"
                  style={{
                    width: `${result.confidence}%`,
                  }}
                />
              </div>

              <span className="confidence-value font-mono">
                {result.confidence}% confidence
              </span>
            </div>
          </>
        ) : (
          <div className="result-empty-state">
            Waiting for a sign...
          </div>
        )}
      </div>

      <div className="result-translation-area">
        <div className="result-section-label">
          Translation
        </div>

        {result ? (
          <>
            <div className="result-translation-text font-display">
              {result.translation}
            </div>

            <div className="result-translation-sub">
              English · Indian Sign Language
            </div>
          </>
        ) : (
          <div className="result-placeholder">
            Start the camera and capture an ISL gesture.
          </div>
        )}
      </div>

      <div className="result-actions">
        <button
          className="btn btn-primary"
          onClick={() =>
            result && onSpeak(result.translation)
          }
          disabled={!result}
        >
          <SpeakerIcon />
          Speak
        </button>

        <button
          className="btn btn-outline"
          onClick={handleCopy}
          disabled={!result}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function TranslatingSpinner() {
  return (
    <div className="translating-spinner">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            animationDelay: `${index * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
    >
      <path
        d="M2 5.5H5L9 2.5V12.5L5 9.5H2V5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M11.5 4.5C12.5 5.5 13 6.5 13 7.5C13 8.5 12.5 9.5 11.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <rect
        x="4"
        y="4"
        width="8"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M2 10V2.5C2 1.67 2.67 1 3.5 1H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path
        d="M2 7L5.5 10.5L12 4"
        stroke="var(--success)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}