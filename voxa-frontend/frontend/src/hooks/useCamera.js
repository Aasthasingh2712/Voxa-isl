import { useRef, useState, useCallback } from "react";

export function useCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraState, setCameraState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const startCamera = useCallback(async () => {
    setCameraState("loading");
    setErrorMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("active");
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setErrorMessage(
          "Camera permission denied. Please allow camera access."
        );
        setCameraState("error");
      } else if (err?.name === "NotFoundError") {
        setErrorMessage("No camera found on this device.");
        setCameraState("unavailable");
      } else {
        setErrorMessage("Could not access camera.");
        setCameraState("error");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraState("idle");
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || cameraState !== "active") {
      return null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    return ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [cameraState]);

  return {
    videoRef,
    canvasRef,
    cameraState,
    startCamera,
    stopCamera,
    captureFrame,
    errorMessage,
  };
}
