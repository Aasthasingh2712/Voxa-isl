import { useEffect, useRef, useState, useCallback } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// MediaPipe 21 Hand Landmark connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index finger
  [5, 9], [9, 10], [10, 11], [11, 12],   // Middle finger
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring finger
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // Pinky & Palm base
];

export function useHandLandmarker() {
  const handLandmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const [isLandmarkerReady, setIsLandmarkerReady] = useState(false);
  const [landmarkerError, setLandmarkerError] = useState(null);
  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [landmarks, setLandmarks] = useState([]);
  const [handedness, setHandedness] = useState(null); // "Left" | "Right" | null of preferred hand
  const [hands, setHands] = useState([]);
  const [leftHand, setLeftHand] = useState(null);
  const [rightHand, setRightHand] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function initLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        let landmarker;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          });
        } catch (gpuError) {
          console.warn("GPU delegate failed, falling back to CPU delegate:", gpuError);
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          });
        }

        if (isMounted) {
          handLandmarkerRef.current = landmarker;
          setIsLandmarkerReady(true);
        }
      } catch (err) {
        console.error("Failed to initialize MediaPipe HandLandmarker:", err);
        if (isMounted) {
          setLandmarkerError(err?.message || "Failed to load MediaPipe HandLandmarker");
        }
      }
    }

    initLandmarker();

    return () => {
      isMounted = false;
      if (handLandmarkerRef.current) {
        try {
          handLandmarkerRef.current.close();
        } catch (e) {
          console.warn("Error closing HandLandmarker:", e);
        }
        handLandmarkerRef.current = null;
      }
    };
  }, []);

  const clearCanvas = useCallback((canvas) => {
    lastVideoTimeRef.current = -1;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
        setHandDetected((prev) => (prev ? false : prev));
    setHandCount((prev) => (prev ? 0 : prev));
    setLandmarks((prev) => (prev.length ? [] : prev));
    setHandedness((prev) => (prev === null ? prev : null));
    setHands((prev) => (prev.length ? [] : prev));
    setLeftHand((prev) => (prev === null ? prev : null));
    setRightHand((prev) => (prev === null ? prev : null));
  }, []);

  const drawLandmarks = useCallback((ctx, landmarksList, width, height, handCategory = null) => {
    if (!landmarksList || landmarksList.length === 0) return;

    ctx.save();

    // Visual styling per handedness:
    // Left hand: Light indigo stroke, sky blue points
    // Right hand: Deep indigo stroke, bright green points
    const strokeColor = handCategory === "Left" ? "#818cf8" : "#6366f1";
    const pointColor = handCategory === "Left" ? "#38bdf8" : "#22c55e";
    const wristColor = handCategory === "Left" ? "#c084fc" : "#ec4899";

    // 1. Draw connecting lines between landmarks
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const p1 = landmarksList[startIdx];
      const p2 = landmarksList[endIdx];

      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // 2. Draw keypoint nodes (21 points)
    for (let i = 0; i < landmarksList.length; i++) {
      const lm = landmarksList[i];
      const cx = lm.x * width;
      const cy = lm.y * height;
      const isWrist = i === 0;

      // Node circle
      ctx.beginPath();
      ctx.arc(cx, cy, isWrist ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = isWrist ? wristColor : pointColor;
      ctx.fill();

      // White inner core
      ctx.beginPath();
      ctx.arc(cx, cy, isWrist ? 3 : 2, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    ctx.restore();
  }, []);

  const processFrame = useCallback(
    (video, canvas) => {
      if (
        !handLandmarkerRef.current ||
        !video ||
        !canvas ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return {
          skipped: true,
          handCount: 0,
          handDetected: false,
          primaryLandmarks: null,
          hands: [],
          leftHand: null,
          rightHand: null,
        };
      }

      if (video.currentTime === lastVideoTimeRef.current) {
        return {
          skipped: true,
          handCount,
          handDetected,
          primaryLandmarks: landmarks && landmarks.length === 21 ? landmarks : null,
          hands,
          leftHand,
          rightHand,
        };
      }
      lastVideoTimeRef.current = video.currentTime;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return {
          skipped: true,
          handCount: 0,
          handDetected: false,
          primaryLandmarks: null,
          hands: [],
          leftHand: null,
          rightHand: null,
        };
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timestamp = performance.now();
      let results;
      try {
        results = handLandmarkerRef.current.detectForVideo(video, timestamp);
      } catch (err) {
        console.error("Error detecting hand landmarks:", err);
        return {
          skipped: false,
          handCount: 0,
          handDetected: false,
          primaryLandmarks: null,
          hands: [],
          leftHand: null,
          rightHand: null,
        };
      }

      const validLandmarkArrays = (results?.landmarks || []).filter(
        (handLm) => Array.isArray(handLm) && handLm.length === 21
      );
      const detectedCount = validLandmarkArrays.length;

      if (detectedCount > 0) {
        const detectedHands = validLandmarkArrays.map((handLm, idx) => {
          const formattedLandmarks = handLm.map((lm) => ({
            x: Number(lm.x),
            y: Number(lm.y),
            z: Number(lm.z),
          }));

          let detectedHandedness = null;
          if (
            results.handednesses &&
            results.handednesses[idx] &&
            results.handednesses[idx].length > 0
          ) {
            detectedHandedness =
              results.handednesses[idx][0]?.categoryName ?? null;
          }

          return {
            landmarks: formattedLandmarks,
            rawLandmarks: handLm,
            handedness: detectedHandedness,
          };
        });

        // Map into Left and Right hands deterministically
        let leftHandObj = null;
        let rightHandObj = null;

        // Pass 1: exact MediaPipe categoryName match ("Left" / "Right")
        for (const hand of detectedHands) {
          if (hand.handedness === "Left" && !leftHandObj) {
            leftHandObj = hand;
          } else if (hand.handedness === "Right" && !rightHandObj) {
            rightHandObj = hand;
          }
        }

        // Pass 2: assign any unassigned hand to open slot
        for (const hand of detectedHands) {
          if (hand !== leftHandObj && hand !== rightHandObj) {
            if (!rightHandObj) {
              rightHandObj = hand;
            } else if (!leftHandObj) {
              leftHandObj = hand;
            }
          }
        }

        // Select primary single hand for existing digit model (prefer Right, else Left, else first valid hand)
        const primaryHand = rightHandObj || leftHandObj || detectedHands[0];
        const primaryLandmarks = primaryHand ? primaryHand.landmarks : null;
        const primaryHandedness = primaryHand ? primaryHand.handedness : null;

        // Draw landmarks/connections for ALL valid detected hands directly on canvas
        for (const hand of detectedHands) {
          drawLandmarks(ctx, hand.rawLandmarks, canvas.width, canvas.height, hand.handedness);
        }

        const leftRes = leftHandObj ? { landmarks: leftHandObj.landmarks, handedness: "Left" } : null;
        const rightRes = rightHandObj ? { landmarks: rightHandObj.landmarks, handedness: "Right" } : null;

        setHandDetected(true);
        setHandCount(detectedCount);
        setLandmarks(primaryLandmarks || []);
        setHandedness(primaryHandedness);
        setHands(detectedHands);
        setLeftHand(leftRes);
        setRightHand(rightRes);

        return {
          skipped: false,
          handCount: detectedCount,
          handDetected: true,
          primaryLandmarks,
          hands: detectedHands,
          leftHand: leftRes,
          rightHand: rightRes,
        };
      } else {
        setHandDetected(false);
        setHandCount(0);
        setLandmarks([]);
        setHandedness(null);
        setHands([]);
        setLeftHand(null);
        setRightHand(null);

        return {
          skipped: false,
          handCount: 0,
          handDetected: false,
          primaryLandmarks: null,
          hands: [],
          leftHand: null,
          rightHand: null,
        };
      }
    },
    [drawLandmarks, handCount, handDetected, hands, landmarks, leftHand, rightHand]
  );

  return {
    isLandmarkerReady,
    landmarkerError,
    handDetected,
    handCount,
    handedness,
    landmarks,
    hands,
    leftHand,
    rightHand,
    processFrame,
    clearCanvas,
  };
}
