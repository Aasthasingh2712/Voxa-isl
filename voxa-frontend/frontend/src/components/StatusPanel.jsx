export default function StatusPanel({
  cameraState,
  handDetected,
  modelReady,
  isTranslating,
}) {
  const getCameraStatus = () => {
    if (cameraState === "active") {
      return {
        label: "Camera",
        value: "Connected",
        kind: "ready",
      };
    }

    if (cameraState === "loading") {
      return {
        label: "Camera",
        value: "Starting",
        kind: "processing",
      };
    }

    if (
      cameraState === "error" ||
      cameraState === "unavailable"
    ) {
      return {
        label: "Camera",
        value: "Error",
        kind: "error",
      };
    }

    return {
      label: "Camera",
      value: "Off",
      kind: "idle",
    };
  };

  const getHandStatus = () => {
    if (cameraState !== "active") {
      return {
        label: "Hand",
        value: "Waiting",
        kind: "idle",
      };
    }

    if (handDetected) {
      return {
        label: "Hand",
        value: "Detected",
        kind: "ready",
      };
    }

    return {
      label: "Hand",
      value: "Not Detected",
      kind: "idle",
    };
  };

  const getModelStatus = () => {
    if (isTranslating) {
      return {
        label: "Model",
        value: "Processing",
        kind: "processing",
      };
    }

    if (modelReady) {
      return {
        label: "Model",
        value: "Ready",
        kind: "ready",
      };
    }

    return {
      label: "Model",
      value: "Loading",
      kind: "processing",
    };
  };

  const items = [
    getCameraStatus(),
    getHandStatus(),
    getModelStatus(),
  ];

  return (
    <div className="status-panel">
      {items.map((item, index) => (
        <div
          key={item.label}
          className="status-item-wrapper"
        >
          {index > 0 && (
            <div className="status-divider" />
          )}

          <div className="status-item">
            <span
              className={`status-indicator ${item.kind}`}
            />

            <span className="status-label">
              {item.label}
            </span>

            <span
              className={`status-value ${item.kind}`}
            >
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}