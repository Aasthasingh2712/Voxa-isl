import { useState, useCallback, useRef, useEffect } from "react";
import { INITIAL_HISTORY } from "../utils/mockData";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const CONSECUTIVE_REQUIRED = 3;
// Frames below this confidence never count toward a letter (raise it for fewer false letters).
const AZ_MIN_CONFIDENCE = 0.6;

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
  const sentenceRef = useRef(""); // letters committed so far (the text being spelled)

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
    sentenceRef.current = "";
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

  // A-Z fingerspelling: sends BOTH hands (each tagged Left/Right) to /predict-az and
  // builds a sentence out of the letters that stay stable for a few predictions in a row.
  const translateHands = useCallback(async (hands) => {
    if (requestInFlightRef.current || !hands) return;

    const isValidHand = (h) =>
      h &&
      Array.isArray(h.landmarks) &&
      h.landmarks.length === 21 &&
      h.landmarks.every(
        (lm) =>
          lm &&
          Number.isFinite(lm.x) &&
          Number.isFinite(lm.y) &&
          Number.isFinite(lm.z)
      );
    const toPayload = (handedness, h) => ({
      handedness,
      landmarks: h.landmarks.map((lm) => ({
        x: Number(lm.x),
        y: Number(lm.y),
        z: Number(lm.z),
      })),
    });

    const payloadHands = [];
    if (isValidHand(hands.left)) payloadHands.push(toPayload("Left", hands.left));
    if (isValidHand(hands.right)) payloadHands.push(toPayload("Right", hands.right));
    if (payloadHands.length === 0) return;

    requestInFlightRef.current = true;
    setIsTranslating(true);

    const seq = ++requestSequenceRef.current;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const res = await fetch(`${API_BASE_URL}/predict-az`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hands: payloadHands }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();

      if (seq !== requestSequenceRef.current || controller.signal.aborted) {
        return;
      }

      setModelReady(true);
      setApiError(null);

      const letter = String(data.prediction);
      const confidence = Number(data.confidence);
      const sure = confidence >= AZ_MIN_CONFIDENCE;

      // An unsure frame breaks the "same letter N times in a row" run.
      predictionBufferRef.current.push(sure ? letter : null);
      const buf = predictionBufferRef.current;
      if (buf.length > 20) buf.shift();
      if (!sure) return;

      let consecutiveCount = 0;
      for (let i = buf.length - 1; i >= 0; i--) {
        if (buf[i] === letter) {
          consecutiveCount++;
        } else {
          break;
        }
      }

      if (
        consecutiveCount >= CONSECUTIVE_REQUIRED &&
        lastCommittedSignRef.current !== letter
      ) {
        lastCommittedSignRef.current = letter;
        sentenceRef.current += letter;

        const confPercent = Math.round(confidence * 100);
        const id = Date.now().toString();
        const timestamp = new Date();

        setCurrentTranslation({
          id,
          sign: letter,
          translation: sentenceRef.current,
          confidence: confPercent,
          timestamp,
        });
        setHistory((prev) =>
          [
            { id, sign: letter, translation: letter, confidence: confPercent, timestamp },
            ...prev,
          ].slice(0, 20)
        );
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
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

  const addSpace = useCallback(() => {
    if (!sentenceRef.current || sentenceRef.current.endsWith(" ")) return;
    sentenceRef.current += " ";
    const text = sentenceRef.current;
    setCurrentTranslation((prev) => (prev ? { ...prev, translation: text } : prev));
  }, []);

  const backspace = useCallback(() => {
    if (!sentenceRef.current) return;
    sentenceRef.current = sentenceRef.current.slice(0, -1);
    const text = sentenceRef.current;
    setCurrentTranslation((prev) =>
      text
        ? {
            id: Date.now().toString(),
            sign: text.trim().slice(-1),
            translation: text,
            confidence: prev ? prev.confidence : 100,
            timestamp: new Date(),
          }
        : null
    );
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
    translateHands,
    addSpace,
    backspace,
    resetStabilization,
    clearTranslation,
    clearHistory,
    speakText,
    checkHealth,
    abortPendingRequests,
  };
}