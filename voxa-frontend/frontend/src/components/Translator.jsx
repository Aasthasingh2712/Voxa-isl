import { useEffect, useRef, useCallback } from "react";
import { useCamera } from "../hooks/useCamera";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import CameraPreview from "./CameraPreview";
import TranslationResult from "./TranslationResult";
import StatusPanel from "./StatusPanel";
import SpeechToSign from "./SpeechToSign";

export default function Translator({ translator }) {
  const camera = useCamera();
  const landmarker = useHandLandmarker();
  const animFrameIdRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const latestHandsRef = useRef(null);
  const wasHandDetectedRef = useRef(false);
  const noHandFrameCountRef = useRef(0);

  // Maintain a ref to the latest translator object to prevent callback identity changes
  // from tearing down effects or aborting active requests on ordinary re-renders.
  const translatorRef = useRef(translator);
  translatorRef.current = translator;

  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      const video = camera.videoRef.current;
      const canvas = camera.canvasRef.current;

      if (
        document.visibilityState !== "hidden" &&
        video &&
        canvas &&
        camera.cameraState === "active"
      ) {
        const res = landmarker.processFrame(video, canvas);
        if (res && res.skipped) {
          // Video frame was not updated yet; preserve current detection state
          if (camera.cameraState === "active" && landmarker.isLandmarkerReady) {
            animFrameIdRef.current = requestAnimationFrame(loop);
          }
          return;
        }

        if (res && res.primaryLandmarks && res.primaryLandmarks.length === 21) {
          latestLandmarksRef.current = res.primaryLandmarks;
          latestHandsRef.current = { left: res.leftHand, right: res.rightHand };
          wasHandDetectedRef.current = true;
          noHandFrameCountRef.current = 0;
        } else {
          noHandFrameCountRef.current += 1;
          // Only declare hand genuinely lost after ~10 consecutive missing frames (~300ms)
          // to protect against single-frame MediaPipe video detection drops/jitter.
          if (noHandFrameCountRef.current >= 10) {
            latestLandmarksRef.current = null;
            if (wasHandDetectedRef.current) {
              translatorRef.current.resetStabilization();
              wasHandDetectedRef.current = false;
            }
          }
        }
      }

      if (camera.cameraState === "active" && landmarker.isLandmarkerReady) {
        animFrameIdRef.current = requestAnimationFrame(loop);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && camera.canvasRef.current) {
        landmarker.clearCanvas(camera.canvasRef.current);
        latestLandmarksRef.current = null;
        if (wasHandDetectedRef.current) {
          translatorRef.current.resetStabilization();
          wasHandDetectedRef.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (
      camera.cameraState === "active" &&
      landmarker.isLandmarkerReady &&
      !document.hidden
    ) {
      animFrameIdRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (camera.canvasRef.current) {
        landmarker.clearCanvas(camera.canvasRef.current);
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
    camera.cameraState,
    camera.videoRef,
    camera.canvasRef,
    landmarker.isLandmarkerReady,
    landmarker.processFrame,
    landmarker.clearCanvas,
  ]);

  // Prediction loop: stable ~400ms interval for continuous backend inference.
  // Dependencies are strictly limited to cameraState and handDetected so state changes
  // (isTranslating, predictions, modelReady) do NOT destroy/recreate the timer or abort in-flight requests.
  useEffect(() => {
    if (camera.cameraState !== "active") {
      translatorRef.current.abortPendingRequests();
      return;
    }

    const intervalId = setInterval(() => {
      if (
        camera.cameraState === "active" &&
        landmarker.handDetected &&
        latestLandmarksRef.current &&
        latestLandmarksRef.current.length === 21
      ) {
        translatorRef.current.translateHands(latestHandsRef.current);
      }
    }, 400);

    return () => {
      clearInterval(intervalId);
      translatorRef.current.abortPendingRequests();
    };
  }, [camera.cameraState, landmarker.handDetected]);

  const handleStop = useCallback(() => {
    translatorRef.current.abortPendingRequests();
    translatorRef.current.resetStabilization();
    translatorRef.current.clearTranslation();
    latestLandmarksRef.current = null;
    wasHandDetectedRef.current = false;
    noHandFrameCountRef.current = 0;

    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (camera.canvasRef.current) {
      landmarker.clearCanvas(camera.canvasRef.current);
    }

    camera.stopCamera();
  }, [
    camera.canvasRef,
    camera.stopCamera,
    landmarker.clearCanvas,
  ]);

  const handleCapture = () => {
    camera.captureFrame();
    if (latestLandmarksRef.current) {
      translatorRef.current.translateHands(latestHandsRef.current);
    }
  };

  return (
    <section className="translator-section" id="translator">
      <div className="container">
        <div className="translator-header">
          <div className="section-label">Workspace</div>

          <h2
            className="section-title"
            style={{ textAlign: "center" }}
          >
            ISL Translator
          </h2>

          <p
            className="section-subtitle"
            style={{
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            Start your camera and spell words in ISL fingerspelling (A-Z), one letter at a time. Hold each letter steady for about a second.
          </p>
        </div>

        <StatusPanel
          cameraState={camera.cameraState}
          handDetected={landmarker.handDetected}
          modelReady={translator.modelReady && landmarker.isLandmarkerReady}
          isTranslating={translator.isTranslating}
        />

        <div className="translator-workspace">
          <CameraPreview
            videoRef={camera.videoRef}
            canvasRef={camera.canvasRef}
            cameraState={camera.cameraState}
            errorMessage={camera.errorMessage || landmarker.landmarkerError}
            handDetected={landmarker.handDetected}
            onStart={camera.startCamera}
            onStop={handleStop}
            onCapture={handleCapture}
          />

          <TranslationResult
            result={translator.currentTranslation}
            isTranslating={translator.isTranslating}
            onSpeak={translator.speakText}
            onClear={translator.clearTranslation}
            onSpace={translator.addSpace}
            onBackspace={translator.backspace}
          />
        </div>
        <SpeechToSign />
      </div>
    </section>
  );
}
