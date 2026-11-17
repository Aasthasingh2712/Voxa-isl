import { useEffect, useRef, useState, useCallback } from "react";
import { useCamera } from "../hooks/useCamera";
import { useHandLandmarker } from "../hooks/useHandLandmarker";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ALPHABETS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

// generateSessionId is defined outside the component so it is never called
// during render (satisfies react/purity lint rule). It runs exactly once per
// page load via the useRef initializer.
function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  const ts = typeof performance !== "undefined" ? performance.now().toString(36) : Date.now().toString(36);
  const rnd = Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")
  ).join("-");
  return `session-${ts}-${rnd}`;
}

// generateSampleId returns a UUID-style string suitable for globally unique
// per-row identification when merging CSV files from multiple sessions.
function generateSampleId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const ts = typeof performance !== "undefined" ? performance.now().toString(36) : Date.now().toString(36);
  const rnd = Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")
  ).join("-");
  return `smpl-${ts}-${rnd}`;
}

export default function DataCollector() {
  const {
    videoRef,
    canvasRef,
    cameraState,
    startCamera,
    stopCamera,
    errorMessage: cameraErrorMessage,
  } = useCamera();

  const {
    isLandmarkerReady,
    landmarkerError,
    handDetected,
    handCount,
    leftHand,
    rightHand,
    processFrame,
    clearCanvas,
  } = useHandLandmarker();

  const animFrameIdRef = useRef(null);
  const lastSavedVideoTimeRef = useRef(-1);
  const latestFrameRef = useRef(null);

  // Mode selection: "numbers" (0-9) vs "alphabets" (A-Z)
  const [mode, setMode] = useState("numbers");

  // Session-level identifiers — generated once per page load, never contain PII.
  // session_id groups all samples collected in one browser session.
  const [displaySessionId] = useState(generateSessionId);
  const sessionIdRef = useRef(displaySessionId);

  // Cooldown: minimum ms between any two saves (prevents near-duplicate frames).
  const SAVE_COOLDOWN_MS = 700;
  const lastSaveTimestampRef = useRef(0);

  const [signerId, setSignerId] = useState("");
  const [samples, setSamples] = useState([]);
  const [statusMessage, setStatusMessage] = useState({
    text: "Ready to collect samples. Start the camera to begin.",
    type: "info",
  });

  // Wiring camera & landmarker in requestAnimationFrame loop
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        document.visibilityState !== "hidden" &&
        video &&
        canvas &&
        cameraState === "active"
      ) {
        const res = processFrame(video, canvas);
        if (res && !res.skipped) {
          latestFrameRef.current = res;
        }
      }

      if (cameraState === "active" && isLandmarkerReady) {
        animFrameIdRef.current = requestAnimationFrame(loop);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && canvasRef.current) {
        clearCanvas(canvasRef.current);
        latestFrameRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (
      cameraState === "active" &&
      isLandmarkerReady &&
      !document.hidden
    ) {
      animFrameIdRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (canvasRef.current) {
        clearCanvas(canvasRef.current);
        latestFrameRef.current = null;
      }
    }

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [
    cameraState,
    videoRef,
    canvasRef,
    isLandmarkerReady,
    processFrame,
    clearCanvas,
  ]);

  const handleStopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (canvasRef.current) {
      clearCanvas(canvasRef.current);
      latestFrameRef.current = null;
    }
    stopCamera();
  }, [canvasRef, clearCanvas, stopCamera]);

  // Save sample logic (supports both digits 0-9 and uppercase letters A-Z)
  const handleSaveSample = useCallback(
    (label) => {
      // 1. Camera must be active
      if (cameraState !== "active") {
        setStatusMessage({
          text: `Cannot save sample '${label}': Camera is not active.`,
          type: "error",
        });
        return;
      }

      // 2. Signer ID is required — must not be empty
      if (!signerId.trim()) {
        setStatusMessage({
          text: "Signer ID is required. Enter an anonymous ID (e.g. signer01) before saving.",
          type: "error",
        });
        return;
      }

      // Read latest frame synchronously from ref
      const currentFrame = latestFrameRef.current;
      const frameLeftHand = currentFrame?.leftHand;
      const frameRightHand = currentFrame?.rightHand;
      const frameHandCount = currentFrame?.handCount || 0;

      // 3. At least one hand must be detected
      if (!frameHandCount || (!frameLeftHand && !frameRightHand)) {
        setStatusMessage({
          text: `Cannot save sample '${label}': No hand detected! Ensure keypoints are visible.`,
          type: "error",
        });
        return;
      }

      // 4. Video element must be available
      const video = videoRef.current;
      if (!video) {
        setStatusMessage({
          text: `Cannot save sample '${label}': Video element unavailable.`,
          type: "error",
        });
        return;
      }

      // 5. Duplicate same-frame guard
      const currentVideoTime = video.currentTime;
      if (currentVideoTime === lastSavedVideoTimeRef.current) {
        setStatusMessage({
          text: `Duplicate frame detected (${currentVideoTime.toFixed(2)}s). Move hand slightly before saving sample '${label}'.`,
          type: "warning",
        });
        return;
      }

      // 6. Global cooldown guard (700 ms)
      const now = Date.now();
      const msSinceLast = now - lastSaveTimestampRef.current;
      if (msSinceLast < SAVE_COOLDOWN_MS) {
        const remaining = Math.ceil((SAVE_COOLDOWN_MS - msSinceLast) / 100) * 100;
        setStatusMessage({
          text: `Save cooldown active — wait ${remaining}ms before saving again.`,
          type: "warning",
        });
        return;
      }

      // All guards passed — record save time and video time
      lastSavedVideoTimeRef.current = currentVideoTime;
      lastSaveTimestampRef.current = now;

      // Extract raw float values for Left hand if present (63 values)
      let leftRawValues = null;
      if (frameLeftHand && frameLeftHand.landmarks && frameLeftHand.landmarks.length === 21) {
        leftRawValues = [];
        for (let i = 0; i < 21; i++) {
          const lm = frameLeftHand.landmarks[i];
          leftRawValues.push(lm.x, lm.y, lm.z);
        }
      }

      // Extract raw float values for Right hand if present (63 values)
      let rightRawValues = null;
      if (frameRightHand && frameRightHand.landmarks && frameRightHand.landmarks.length === 21) {
        rightRawValues = [];
        for (let i = 0; i < 21; i++) {
          const lm = frameRightHand.landmarks[i];
          rightRawValues.push(lm.x, lm.y, lm.z);
        }
      }

      const leftHandPresent = leftRawValues ? 1 : 0;
      const rightHandPresent = rightRawValues ? 1 : 0;

      // 8. Build sample record (Schema Version 2)
      const newSample = {
        sample_id: generateSampleId(),
        session_id: sessionIdRef.current,
        signer_id: signerId.trim(),
        label: label, // Integer 0-9 or uppercase string "A"-"Z"
        schema_version: 2,
        timestamp: new Date().toISOString(),
        left_hand_present: leftHandPresent,
        right_hand_present: rightHandPresent,
        leftRawValues,
        rightRawValues,
      };

      setSamples((prev) => [...prev, newSample]);
      const labelDesc = typeof label === "number" ? `Digit ${label}` : `Letter ${label}`;
      const handDesc =
        leftHandPresent && rightHandPresent
          ? "Left & Right hands"
          : leftHandPresent
            ? "Left hand"
            : "Right hand";

      setStatusMessage({
        text: `Saved sample for ${labelDesc} (${handDesc}). Total: ${samples.length + 1}`,
        type: "success",
      });
    },
    [
      cameraState,
      videoRef,
      signerId,
      samples.length,
    ]
  );

  // Keyboard shortcut listener (0-9 for numbers mode, A-Z for alphabets mode)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (mode === "numbers") {
        if (e.key >= "0" && e.key <= "9") {
          const digit = parseInt(e.key, 10);
          handleSaveSample(digit);
        }
      } else if (mode === "alphabets") {
        if (e.key.length === 1) {
          const char = e.key.toUpperCase();
          if (ALPHABETS.includes(char)) {
            handleSaveSample(char);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveSample, mode]);

  // Export to CSV (Version 2 Schema: 126 coordinate fields + presence flags)
  const handleExportCSV = () => {
    if (samples.length === 0) {
      setStatusMessage({
        text: "No samples collected yet. Nothing to export.",
        type: "warning",
      });
      return;
    }

    // Header structure for CSV v2
    const headers = [
      "sample_id",
      "session_id",
      "signer_id",
      "label",
      "schema_version",
      "timestamp",
      "left_hand_present",
      "right_hand_present",
    ];
    for (let i = 0; i < 21; i++) {
      headers.push(`left_x${i}`, `left_y${i}`, `left_z${i}`);
    }
    for (let i = 0; i < 21; i++) {
      headers.push(`right_x${i}`, `right_y${i}`, `right_z${i}`);
    }

    const rows = [headers.join(",")];
    for (const sample of samples) {
      const escapedSampleId   = `"${sample.sample_id}"`;
      const escapedSessionId  = `"${sample.session_id}"`;
      const escapedSignerId   = `"${sample.signer_id.replace(/"/g, '""')}"`;
      const escapedTimestamp  = `"${sample.timestamp}"`;

      const leftCoords = sample.leftRawValues
        ? sample.leftRawValues
        : Array(63).fill("");
      const rightCoords = sample.rightRawValues
        ? sample.rightRawValues
        : Array(63).fill("");

      const row = [
        escapedSampleId,
        escapedSessionId,
        escapedSignerId,
        sample.label,
        sample.schema_version || 2,
        escapedTimestamp,
        sample.left_hand_present,
        sample.right_hand_present,
        ...leftCoords,
        ...rightCoords,
      ];
      rows.push(row.join(","));
    }

    const csvData = rows.join("\n");
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `isl_landmarks_v2_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMessage({
      text: `Exported ${samples.length} samples to CSV v2 (${headers.length} columns).`,
      type: "success",
    });
  };

  // Clear session with confirmation
  const handleClearSession = () => {
    if (samples.length === 0) return;

    if (
      window.confirm(
        `Are you sure you want to clear all ${samples.length} collected samples? This action cannot be undone.`
      )
    ) {
      setSamples([]);
      lastSavedVideoTimeRef.current = -1;
      setStatusMessage({
        text: "Session cleared. All collected samples removed.",
        type: "info",
      });
    }
  };

  // Per-label live counts calculation
  const digitCounts = {};
  DIGITS.forEach((d) => (digitCounts[d] = 0));
  const alphabetCounts = {};
  ALPHABETS.forEach((a) => (alphabetCounts[a] = 0));

  let totalDigitSamples = 0;
  let totalAlphabetSamples = 0;

  samples.forEach((s) => {
    if (typeof s.label === "number" || (typeof s.label === "string" && /^\d+$/.test(s.label))) {
      const d = Number(s.label);
      if (digitCounts[d] !== undefined) {
        digitCounts[d]++;
        totalDigitSamples++;
      }
    } else if (typeof s.label === "string") {
      const upper = s.label.toUpperCase();
      if (alphabetCounts[upper] !== undefined) {
        alphabetCounts[upper]++;
        totalAlphabetSamples++;
      }
    }
  });

  // Derive unique signer IDs seen this session
  const signerIdsInSession = [...new Set(samples.map((s) => s.signer_id).filter(Boolean))];

  // Status message background colors

  const getStatusBg = (type) => {
    switch (type) {
      case "error":
        return "#fef2f2";
      case "warning":
        return "#fffbe6";
      case "success":
        return "#f0fdf4";
      default:
        return "#f0f7ff";
    }
  };

  const getStatusBorder = (type) => {
    switch (type) {
      case "error":
        return "#fca5a5";
      case "warning":
        return "#fde047";
      case "success":
        return "#86efac";
      default:
        return "#93c5fd";
    }
  };

  const getStatusColor = (type) => {
    switch (type) {
      case "error":
        return "#991b1b";
      case "warning":
        return "#854d0e";
      case "success":
        return "#166534";
      default:
        return "#1e40af";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "Inter, sans-serif",
        padding: "1.5rem",
      }}
    >
      {/* Dev Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1rem 1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <span
            style={{
              backgroundColor: "#ef4444",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: "700",
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            DEVELOPMENT ONLY — Data Collector
          </span>
          <h1
            style={{
              margin: "0.5rem 0 0 0",
              fontSize: "1.5rem",
              fontWeight: "700",
              color: "#ffffff",
            }}
          >
            ISL Hand Landmark Sampler (Numbers 0–9 & Alphabets A–Z)
          </h1>
        </div>
        <div>
          <a
            href="/"
            style={{
              color: "#94a3b8",
              textDecoration: "none",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              backgroundColor: "#334155",
              transition: "all 0.2s",
            }}
          >
            Return to Normal App
          </a>
        </div>
      </div>

      {/* Dynamic Status Toast Banner */}
      <div
        style={{
          backgroundColor: getStatusBg(statusMessage.type),
          borderColor: getStatusBorder(statusMessage.type),
          color: getStatusColor(statusMessage.type),
          borderWidth: "1px",
          borderStyle: "solid",
          borderRadius: "8px",
          padding: "0.75rem 1.25rem",
          marginBottom: "1.5rem",
          fontSize: "0.95rem",
          fontWeight: "500",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span>{statusMessage.text}</span>
      </div>

      {/* Main Grid: Left Camera, Right Controls & Data */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr",
          gap: "1.5rem",
        }}
      >
        {/* Left Column: Camera Viewport & Signer ID */}
        <div
          style={{
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            border: "1px solid #334155",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              backgroundColor: "#020617",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror video preview
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror canvas drawing to match video
                pointerEvents: "none",
              }}
            />

            {cameraState !== "active" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(2, 6, 23, 0.85)",
                  color: "#94a3b8",
                  gap: "0.5rem",
                }}
              >
                {cameraState === "loading" && <p>Initializing camera...</p>}
                {cameraState === "idle" && (
                  <p>Camera inactive. Click "Start Camera" below.</p>
                )}
                {(cameraState === "error" || cameraState === "unavailable") && (
                  <p style={{ color: "#ef4444" }}>
                    {cameraErrorMessage || landmarkerError || "Camera error"}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Camera Controls & Indicators */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {cameraState === "active" ? (
                <button
                  type="button"
                  onClick={handleStopCamera}
                  style={{
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Stop Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  style={{
                    backgroundColor: "#3b82f6",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Start Camera
                </button>
              )}
            </div>

            {/* Hand detection + two-hand status badges */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                fontSize: "0.875rem",
              }}
            >
              <span style={{ color: "#94a3b8" }}>Detected Hands:</span>
              <span
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: "700",
                  fontSize: "0.75rem",
                  backgroundColor: handCount > 0 ? "#166534" : "#334155",
                  color: handCount > 0 ? "#86efac" : "#94a3b8",
                }}
              >
                {handCount} / 2
              </span>
              <span
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  backgroundColor: leftHand ? "#581c87" : "#1e293b",
                  color: leftHand ? "#d8b4fe" : "#64748b",
                  border: `1px solid ${leftHand ? "#7e22ce" : "#334155"}`,
                }}
              >
                Left: {leftHand ? "Detected" : "Not detected"}
              </span>
              <span
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  backgroundColor: rightHand ? "#075985" : "#1e293b",
                  color: rightHand ? "#7dd3fc" : "#64748b",
                  border: `1px solid ${rightHand ? "#0284c7" : "#334155"}`,
                }}
              >
                Right: {rightHand ? "Detected" : "Not detected"}
              </span>
            </div>
          </div>

          {/* Signer ID Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label
              htmlFor="signer-id-input"
              style={{ fontSize: "0.875rem", color: "#cbd5e1", fontWeight: "500" }}
            >
              Signer ID{" "}
              <span style={{ color: "#ef4444", fontWeight: "700" }}>*</span>
              {" "}<span style={{ color: "#64748b", fontWeight: "400" }}>(required — use anonymous ID only, e.g. signer01)</span>
            </label>
            <input
              id="signer-id-input"
              type="text"
              value={signerId}
              onChange={(e) => setSignerId(e.target.value)}
              placeholder="e.g. signer01  signer02  signer03"
              style={{
                backgroundColor: "#0f172a",
                border: `1px solid ${signerId.trim() ? "#22c55e" : "#ef4444"}`,
                borderRadius: "6px",
                padding: "0.5rem 0.75rem",
                color: "#ffffff",
                fontSize: "0.9rem",
              }}
            />
            {!signerId.trim() && (
              <span style={{ fontSize: "0.78rem", color: "#ef4444" }}>
                ⚠ Enter a signer ID before saving any sample.
              </span>
            )}
            {/* Session metadata display */}
            <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#475569" }}>
              <span>Session: </span>
              <code style={{ color: "#64748b", fontSize: "0.7rem" }}>
                {displaySessionId}
              </code>
            </div>
            {signerIdsInSession.length > 0 && (
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Signer IDs this session: {signerIdsInSession.join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Collection Mode, Label Controls & Session Summary */}
        <div
          style={{
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            border: "1px solid #334155",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Mode Selector Tabs */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: "600",
                color: "#cbd5e1",
                marginBottom: "0.5rem",
              }}
            >
              Collection Target Mode:
            </label>
            <div
              style={{
                display: "flex",
                backgroundColor: "#0f172a",
                padding: "0.25rem",
                borderRadius: "8px",
                border: "1px solid #334155",
                gap: "0.25rem",
              }}
            >
              <button
                type="button"
                onClick={() => setMode("numbers")}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "700",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: mode === "numbers" ? "#3b82f6" : "transparent",
                  color: mode === "numbers" ? "#ffffff" : "#94a3b8",
                  transition: "all 0.15s ease",
                }}
              >
                Numbers (0–9)
              </button>
              <button
                type="button"
                onClick={() => setMode("alphabets")}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "700",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: mode === "alphabets" ? "#3b82f6" : "transparent",
                  color: mode === "alphabets" ? "#ffffff" : "#94a3b8",
                  transition: "all 0.15s ease",
                }}
              >
                Alphabets (A–Z)
              </button>
            </div>
          </div>

          {/* Section Description */}
          <div>
            <h2
              style={{
                margin: "0 0 0.25rem 0",
                fontSize: "1.1rem",
                fontWeight: "600",
                color: "#f8fafc",
              }}
            >
              {mode === "numbers" ? "Digit Labels (0–9)" : "Alphabet Labels (A–Z)"}
            </h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
              {mode === "numbers"
                ? "Click a digit button or press keyboard numbers 0–9 to save landmarks."
                : "Click a letter button or press keyboard keys A–Z to save landmarks."}
            </p>
          </div>

          {/* Label Grid Buttons */}
          {mode === "numbers" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "0.75rem",
              }}
            >
              {DIGITS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleSaveSample(digit)}
                  disabled={cameraState !== "active" || !handDetected}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      cameraState === "active" && handDetected
                        ? "#3b82f6"
                        : "#334155",
                    opacity:
                      cameraState === "active" && handDetected ? 1 : 0.5,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.75rem 0.5rem",
                    cursor:
                      cameraState === "active" && handDetected
                        ? "pointer"
                        : "not-allowed",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "800",
                      lineHeight: "1",
                    }}
                  >
                    {digit}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "#cbd5e1",
                      marginTop: "0.25rem",
                    }}
                  >
                    Key: {digit}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "0.5rem",
                maxHeight: "260px",
                overflowY: "auto",
                paddingRight: "0.25rem",
              }}
            >
              {ALPHABETS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleSaveSample(letter)}
                  disabled={cameraState !== "active" || !handDetected}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      cameraState === "active" && handDetected
                        ? "#2563eb"
                        : "#334155",
                    opacity:
                      cameraState === "active" && handDetected ? 1 : 0.5,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.5rem 0.25rem",
                    cursor:
                      cameraState === "active" && handDetected
                        ? "pointer"
                        : "not-allowed",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "800",
                      lineHeight: "1",
                    }}
                  >
                    {letter}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      color: "#93c5fd",
                      marginTop: "0.2rem",
                    }}
                  >
                    Key: {letter}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Per-Label Live Counts Table */}
          <div>
            <h3
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "0.95rem",
                fontWeight: "600",
                color: "#cbd5e1",
              }}
            >
              {mode === "numbers"
                ? `Samples Collected per Digit (Total Digits: ${totalDigitSamples})`
                : `Samples Collected per Alphabet (Total Alphabets: ${totalAlphabetSamples})`}
            </h3>
            {mode === "numbers" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "0.5rem",
                  backgroundColor: "#0f172a",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  border: "1px solid #334155",
                }}
              >
                {DIGITS.map((d) => (
                  <div
                    key={d}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#1e293b",
                      padding: "0.35rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ fontWeight: "700", color: "#38bdf8" }}>
                      Digit {d}:
                    </span>
                    <span style={{ fontWeight: "600", color: "#ffffff" }}>
                      {digitCounts[d]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "0.4rem",
                  backgroundColor: "#0f172a",
                  borderRadius: "8px",
                  padding: "0.6rem",
                  border: "1px solid #334155",
                  maxHeight: "180px",
                  overflowY: "auto",
                }}
              >
                {ALPHABETS.map((a) => (
                  <div
                    key={a}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#1e293b",
                      padding: "0.25rem 0.4rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                    }}
                  >
                    <span style={{ fontWeight: "700", color: "#38bdf8" }}>
                      {a}:
                    </span>
                    <span style={{ fontWeight: "600", color: "#ffffff" }}>
                      {alphabetCounts[a]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export & Reset Actions */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: "1rem",
              borderTop: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#94a3b8",
                  fontWeight: "500",
                }}
              >
                Total Collected:{" "}
                <strong style={{ color: "#ffffff", fontSize: "0.95rem" }}>
                  {samples.length}
                </strong>{" "}
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  ({totalDigitSamples} Numbers, {totalAlphabetSamples} Alphabets)
                </span>
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleClearSession}
                disabled={samples.length === 0}
                style={{
                  backgroundColor: "#475569",
                  color: "#ffffff",
                  opacity: samples.length === 0 ? 0.5 : 1,
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.5rem 0.85rem",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: samples.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Clear Session
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={samples.length === 0}
                style={{
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  opacity: samples.length === 0 ? 0.5 : 1,
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: samples.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Export CSV ({samples.length})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
