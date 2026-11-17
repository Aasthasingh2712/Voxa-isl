export default function CameraPreview({
  videoRef,
  canvasRef,
  cameraState,
  errorMessage,
  handDetected,
  onStart,
  onStop,
  onCapture,
}) {
  const isActive = cameraState === "active";
  const isLoading = cameraState === "loading";

  return (
    <div className="card camera-card">
      <div className="camera-card-header">
        <span className="camera-card-title font-display">
          Camera Feed
        </span>

        {isActive && (
          <span className="camera-live-badge">
            <span className="live-dot" />
            Live
          </span>
        )}
      </div>

      <div className="camera-viewport">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            display: isActive ? "block" : "none",
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            display: isActive ? "block" : "none",
          }}
        />

        {!isActive && (
          <div className="camera-placeholder">
            {isLoading ? (
              <>
                <LoadingSpinner />
                <span className="camera-placeholder-text">
                  Requesting camera access...
                </span>
              </>
            ) : cameraState === "error" ||
              cameraState === "unavailable" ? (
              <>
                <CameraErrorIcon />

                <span
                  className="camera-placeholder-text"
                  style={{ color: "var(--error)" }}
                >
                  {errorMessage || "Camera unavailable"}
                </span>
              </>
            ) : (
              <>
                <CameraOffIcon />

                <span className="camera-placeholder-text">
                  Camera is off
                  <br />
                  Click &quot;Start Camera&quot; to begin
                </span>
              </>
            )}
          </div>
        )}

        {isActive && (
          <div className="camera-overlay-text">
            <span className="camera-status-pill">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: handDetected
                    ? "var(--success)"
                    : "var(--text-muted)",
                  display: "inline-block",
                }}
              />

              {handDetected
                ? "Hand Detected"
                : "Waiting for hand"}
            </span>
          </div>
        )}
      </div>

      <div className="camera-controls">
        {!isActive ? (
          <button
            className="btn btn-primary"
            onClick={onStart}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoadingSpinner small />
            ) : (
              <StartIcon />
            )}

            {isLoading ? "Starting..." : "Start Camera"}
          </button>
        ) : (
          <button
            className="btn btn-outline"
            onClick={onStop}
          >
            <StopIcon />
            Stop Camera
          </button>
        )}

        <button
          className="btn btn-accent"
          onClick={onCapture}
          disabled={!isActive}
        >
          <CaptureIcon />
          Capture & Translate
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner({ small }) {
  const size = small ? 14 : 28;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="31.4"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function StartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <circle
        cx="7"
        cy="7"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="7" cy="7" r="3" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="1.5"
        fill="currentColor"
      />
    </svg>
  );
}

function CaptureIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <rect
        x="1"
        y="3"
        width="12"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="7"
        cy="7.5"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CameraOffIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className="camera-placeholder-icon"
    >
      <rect
        x="4"
        y="12"
        width="34"
        height="24"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />

      <circle
        cx="21"
        cy="24"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
      />

      <path
        d="M8 8L40 40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraErrorIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className="camera-placeholder-icon"
    >
      <rect
        x="4"
        y="12"
        width="34"
        height="24"
        rx="4"
        stroke="var(--error)"
        strokeWidth="2"
      />

      <path
        d="M21 19V24"
        stroke="var(--error)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <circle
        cx="21"
        cy="28"
        r="1.5"
        fill="var(--error)"
      />
    </svg>
  );
}