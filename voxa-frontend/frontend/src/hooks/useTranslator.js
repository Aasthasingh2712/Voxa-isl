import { useState, useCallback, useRef, useEffect } from "react";
import { INITIAL_HISTORY } from "../utils/mockData";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const CONSECUTIVE_REQUIRED = 3;

export function useTranslator() {
  const [currentTranslation, setCurrentTranslation] = useState(null);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [isTranslating, setIsTranslating] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [apiError, setApiError] = useState(null);

  const requestInFlightRef = useRef(false);
  const activeAbortControllerRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const predictionBufferRef = useRef([]);
  const lastCommittedSignRef = useRef(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) {
        setModelReady(false);
        return false;
      }
      const data = await res.json();
      const isReady = data.status === "ok" && data.model_loaded === true;
      setModelReady(isReady);
      if (isReady) setApiError(null);
      return isReady;
    } catch (err) {
      setModelReady(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const resetStabilization = useCallback(() => {
    predictionBufferRef.current = [];
    lastCommittedSignRef.current = null;
  }, []);

  const clearTranslation = useCallback(() => {
    setCurrentTranslation(null);
    predictionBufferRef.current = [];
    lastCommittedSignRef.current = null;
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const abortPendingRequests = useCallback(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    requestInFlightRef.current = false;
    setIsTranslating(false);
  }, []);

  const translateLandmarks = useCallback(async (landmarks) => {
    if (requestInFlightRef.current) return;

    // Validate landmark payload shape and finite numeric coordinates
    if (
      !Array.isArray(landmarks) ||
      landmarks.length !== 21 ||
      !landmarks.every(
        (lm) =>
          lm &&
          Number.isFinite(lm.x) &&
          Number.isFinite(lm.y) &&
          Number.isFinite(lm.z)
      )
    ) {
      return;
    }

    requestInFlightRef.current = true;
    setIsTranslating(true);

    const seq = ++requestSequenceRef.current;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const formattedLandmarks = landmarks.map((lm) => ({
        x: Number(lm.x),
        y: Number(lm.y),
        z: Number(lm.z),
      }));

      const res = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ landmarks: formattedLandmarks }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();

      // Check for stale response or aborted request
      if (
        seq !== requestSequenceRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      // Backend succeeded - restore modelReady and clear apiError
      setModelReady(true);
      setApiError(null);

      const rawPrediction = data.prediction; // e.g. 2
      const confidence = data.confidence; // e.g. 0.51

      console.log(`RAW PREDICTION: ${rawPrediction} ${confidence.toFixed(2)}`);

      predictionBufferRef.current.push(rawPrediction);
      const buf = predictionBufferRef.current;
      if (buf.length > 20) buf.shift();
      const len = buf.length;

      // Count consecutive trailing predictions matching rawPrediction
      let consecutiveCount = 0;
      for (let i = len - 1; i >= 0; i--) {
        if (buf[i] === rawPrediction) {
          consecutiveCount++;
        } else {
          break;
        }
      }

      console.log(`STABILIZATION: ${rawPrediction} count=${consecutiveCount}`);

      // Temporal Stabilization: Require 3 consecutive identical predictions
      if (consecutiveCount >= CONSECUTIVE_REQUIRED) {
        const signStr = String(rawPrediction);
        const confPercent = Math.round(confidence * 100);

        const newResult = {
          id: Date.now().toString(),
          sign: signStr,
          translation: signStr,
          confidence: confPercent,
          timestamp: new Date(),
        };

        // Same-sign deduplication while hand remains continuously detected
        if (lastCommittedSignRef.current !== signStr) {
          console.log("COMMITTING STABLE PREDICTION:", {
            prediction: rawPrediction,
            confidence: Number(confidence.toFixed(2)),
          });
          setCurrentTranslation(newResult);
          lastCommittedSignRef.current = signStr;
          setHistory((prev) => [newResult, ...prev].slice(0, 20));
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return; // Silent return for expected request cleanup
      }

      // Backend outage handling: set error state, keep webcam/MediaPipe active
      setModelReady(false);
      setApiError(err.message || "Prediction request failed");
    } finally {
      requestInFlightRef.current = false;
      setIsTranslating(false);
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
      }
    }
  }, []);

  const speakText = useCallback((text) => {
    if (!text || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;

    window.speechSynthesis.speak(utterance);
  }, []);

  return {
    currentTranslation,
    history,
    isTranslating,
    modelReady,
    apiError,
    translateLandmarks,
    resetStabilization,
    clearTranslation,
    clearHistory,
    speakText,
    checkHealth,
    abortPendingRequests,
  };
}