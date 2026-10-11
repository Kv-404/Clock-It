import { useRef, useCallback, useEffect } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { stepEffect } from '../types';
import type { HandData, BoxCoords } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** MediaPipe landmark index for the middle-finger MCP joint */
const MCP_INDEX = 9;

/** Euclidean distance threshold (normalised) that triggers a pinch */
const PINCH_THRESHOLD = 0.08;

/** Number of distinct pinches required to cycle to the next filter */
const PINCHES_TO_CYCLE = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseHandTrackerArgs {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  boxRef: React.MutableRefObject<BoxCoords>;
  handsRef: React.MutableRefObject<HandData[]>;
  setVideoReady: (v: boolean) => void;
  setModelsReady: (v: boolean) => void;
  setErrorMsg: (msg: string) => void;
  setEffectIndex: React.Dispatch<React.SetStateAction<number>>;
  filterLocked?: boolean;
  trackingMode: 'hand' | 'face' | 'full';
}

interface UseHandTrackerReturn {
  /** Call once after the intro screen completes to load MediaPipe and start the webcam. */
  initTracker: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 2-D Euclidean distance between two normalised landmark coords. */
function dist2D(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

type CameraCaps = MediaTrackCapabilities & {
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
};

/** Open the user camera at a sharp size that keeps the sensor's own aspect ratio. */
async function openCamera(): Promise<MediaStream> {
  const profiles: MediaTrackConstraints[] = [
    { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30, max: 60 } },
    { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30 } },
    { facingMode: 'user', width: { ideal: 3840 }, height: { ideal: 2160 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30, max: 30 } },
    { facingMode: 'user' },
  ];

  let opened: MediaStream | null = null;
  let cameraError: unknown = null;
  for (const video of profiles) {
    try {
      opened = await navigator.mediaDevices.getUserMedia({ video });
      break;
    } catch (err) {
      cameraError = err;
      if (err instanceof DOMException && err.name === 'NotAllowedError') break;
    }
  }
  if (!opened) throw cameraError ?? new Error('Camera unavailable');

  const track = opened.getVideoTracks()[0];
  if (track) {
    track.contentHint = 'detail';
    const caps = track.getCapabilities?.() as CameraCaps | undefined;
    const current = track.getSettings();
    const w = current.width ?? 0;
    const h = current.height ?? 0;
    if (w > 0 && h > 0) {
      const aspect = w / h;
      const maxW = Math.min(caps?.width?.max ?? w, 3840);
      const maxH = Math.min(caps?.height?.max ?? h, 2160);
      let targetW = Math.min(maxW, maxH * aspect);
      let targetH = targetW / aspect;
      if (targetH > maxH) {
        targetH = maxH;
        targetW = targetH * aspect;
      }
      // Same shape as the frame we already have, only larger.
      if (targetW > w * 1.2) {
        try {
          await track.applyConstraints({
            width: { ideal: Math.round(targetW) },
            height: { ideal: Math.round(targetH) },
            aspectRatio: { ideal: aspect },
            frameRate: { ideal: 30, max: 60 },
          });
        } catch (err) {
          console.warn('[CLOCKIT] Keeping the camera size already granted:', err);
        }
      }
    }

    const advanced: MediaTrackConstraintSet[] = [];
    if (caps?.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' } as MediaTrackConstraintSet);
    if (caps?.exposureMode?.includes('continuous')) advanced.push({ exposureMode: 'continuous' } as MediaTrackConstraintSet);
    if (caps?.whiteBalanceMode?.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' } as MediaTrackConstraintSet);
    if (advanced.length > 0) {
      try {
        await track.applyConstraints({ advanced });
      } catch (err) {
        console.warn('[CLOCKIT] Camera focus/exposure left on device defaults:', err);
      }
    }

    const settings = track.getSettings();
    console.log('[CLOCKIT] Camera source:', settings.width, 'x', settings.height, '@', settings.frameRate);
  }

  return opened;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHandTracker({
  videoRef,
  boxRef,
  handsRef,
  setVideoReady,
  setModelsReady,
  setErrorMsg,
  setEffectIndex,
  filterLocked = false,
  trackingMode,
}: UseHandTrackerArgs): UseHandTrackerReturn {
  const filterLockedRef = useRef(filterLocked);
  useEffect(() => {
    filterLockedRef.current = filterLocked;
  }, [filterLocked]);

  const trackingModeRef = useRef(trackingMode);
  useEffect(() => {
    trackingModeRef.current = trackingMode;
  }, [trackingMode]);

  /** Stores the RAF id so we can cancel on cleanup. */
  const animFrameRef   = useRef<number>(0);
  const lastResultsRef = useRef<HandData[]>([]);
  const frameCountRef  = useRef<number>(0);
  const wasPinchedRef  = useRef<boolean>(false);
  const pinchCountRef  = useRef<number>(0);
  const eyesClosedRef  = useRef(false);
  const lastBlinkAtRef = useRef(0);

  const initTracker = useCallback(async (): Promise<void> => {
    try {
      // ── 1. Load MediaPipe WASM + model ──────────────────────────────────
      console.log('[CLOCKIT] Starting MediaPipe init...');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      console.log('[CLOCKIT] FilesetResolver done, creating Landmarkers...');

      let landmarker: HandLandmarker;
      let faceLandmarker: FaceLandmarker;

      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          numHands: 2,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('[CLOCKIT] GPU delegate failed for HandLandmarker, falling back to CPU:', gpuError);
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU'
          },
          numHands: 2,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch (faceError) {
        console.warn('[CLOCKIT] GPU delegate failed for FaceLandmarker, falling back to CPU:', faceError);
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      }

      console.log('[CLOCKIT] Landmarkers ready:', !!landmarker, !!faceLandmarker);
      setModelsReady(true);

      // ── 2. Open webcam stream ────────────────────────────────────────────
      let stream: MediaStream;
      try {
        stream = await openCamera();
      } catch (camErr) {
        const isPermissionDenied =
          camErr instanceof DOMException && camErr.name === 'NotAllowedError';

        throw new Error(
          isPermissionDenied
            ? 'Camera permission denied. Please allow camera access and reload.'
            : `Camera error: ${camErr instanceof Error ? camErr.message : String(camErr)}`,
        );
      }

      const video = videoRef.current;
      if (!video) throw new Error('Video element not mounted.');

      video.srcObject = stream;

      // Wait for enough data to be available
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return; }
        video.addEventListener('canplay', () => resolve(), { once: true });
      });

      void video.play().catch(() => {});

      // Confirm video is actually producing frames
      await new Promise<void>((resolve) => {
        const check = () => {
          if (video.videoWidth > 0) { resolve(); return; }
          requestAnimationFrame(check);
        };
        check();
      });

      setVideoReady(true);

      // Tracking runs on a small copy so a 4K camera does not feed MediaPipe full frames.
      const detectCanvas = document.createElement('canvas');
      const detectCtx = detectCanvas.getContext('2d', { alpha: false, willReadFrequently: true });

      const frameForDetect = (): HTMLVideoElement | HTMLCanvasElement => {
        const longest = Math.max(video.videoWidth, video.videoHeight);
        if (!detectCtx || longest === 0 || longest <= 640) return video;
        const scale = 640 / longest;
        const w = Math.max(1, Math.round(video.videoWidth * scale));
        const h = Math.max(1, Math.round(video.videoHeight * scale));
        if (detectCanvas.width !== w || detectCanvas.height !== h) {
          detectCanvas.width = w;
          detectCanvas.height = h;
        }
        detectCtx.drawImage(video, 0, 0, w, h);
        return detectCanvas;
      };

      // ── 3. Animation loop ────────────────────────────────────────────────
      const detect = (): void => {
        frameCountRef.current++;

        // Guard: video must have at least one decoded frame
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        const mode = trackingModeRef.current;

        if (mode === 'full') {
          // Full Screen: filter covers the entire camera, no tracking box
          boxRef.current = [0, 0, 1, 1];
          lastResultsRef.current = [];
        } 
        else if (mode === 'hand') {
          // Hand Tracking: runs MediaPipe HandLandmarker every other frame
          if (frameCountRef.current % 2 === 0) {
            const result = landmarker.detectForVideo(frameForDetect(), performance.now());
            const hands: HandData[] = result.landmarks.map((lmGroup, i) => ({
              landmarks:  lmGroup.map(({ x, y, z }) => ({ x, y, z })),
              handedness: (result.handedness[i]?.[0]?.categoryName ?? 'Left') as 'Left' | 'Right',
            }));
            lastResultsRef.current = hands;

            // Gesture detection (Pinch)
            let isPinched = false;
            for (const hand of hands) {
              if (hand.landmarks.length > 8) {
                const isPinch = dist2D(
                  hand.landmarks[4].x, hand.landmarks[4].y,
                  hand.landmarks[8].x, hand.landmarks[8].y
                ) < PINCH_THRESHOLD;
                if (isPinch) {
                  isPinched = true;
                  break;
                }
              }
            }

            // Bounding-box computation
            if (hands.length === 2) {
              const lm0 = hands[0].landmarks[MCP_INDEX];
              const lm1 = hands[1].landmarks[MCP_INDEX];

              const x0 = lm0.x;
              const y0 = 1.0 - lm0.y;
              const x1 = lm1.x;
              const y1 = 1.0 - lm1.y;

              const distance = dist2D(x0, y0, x1, y1);
              const centerX   = (x0 + x1) / 2;
              const centerY   = (y0 + y1) / 2;
              const boxWidth  = distance * 1.3;
              const boxHeight = boxWidth  * 0.75;

              boxRef.current = [
                clamp01(centerX - boxWidth  / 2),
                clamp01(centerY - boxHeight / 2),
                clamp01(centerX + boxWidth  / 2),
                clamp01(centerY + boxHeight / 2),
              ];
            } else {
              boxRef.current = [0, 0, 0, 0];
            }

            if (isPinched) {
              if (!wasPinchedRef.current) {
                if (!filterLockedRef.current) {
                  pinchCountRef.current += 1;
                  if (pinchCountRef.current >= PINCHES_TO_CYCLE) {
                    setEffectIndex((prev) => stepEffect(prev, 1));
                    pinchCountRef.current = 0;
                  }
                }
                wasPinchedRef.current = true;
              }
            } else {
              wasPinchedRef.current = false;
            }
          }
        } 
        else if (mode === 'face') {
          // Face Tracking: runs MediaPipe FaceLandmarker every other frame
          lastResultsRef.current = [];
          if (frameCountRef.current % 2 === 0) {
            const faceResult = faceLandmarker.detectForVideo(frameForDetect(), performance.now());
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              let xMin = 1.0, yMin = 1.0, xMax = 0.0, yMax = 0.0;
              for (const face of faceResult.faceLandmarks) {
                for (const lm of face) {
                  if (lm.x < xMin) xMin = lm.x;
                  if (lm.y < yMin) yMin = lm.y;
                  if (lm.x > xMax) xMax = lm.x;
                  if (lm.y > yMax) yMax = lm.y;
                }
              }

              // Pad slightly for visual clearance
              const padX = (xMax - xMin) * 0.25;
              const padY = (yMax - yMin) * 0.35;

              boxRef.current = [
                clamp01(xMin - padX),
                clamp01(1.0 - (yMax + padY)),
                clamp01(xMax + padX),
                clamp01(1.0 - (yMin - padY))
              ];
            } else {
              boxRef.current = [0, 0, 0, 0];
              eyesClosedRef.current = false;
            }

            const shapes = faceResult.faceBlendshapes?.[0]?.categories;
            if (shapes && !filterLockedRef.current) {
              const score = (name: string) => shapes.find((shape) => shape.categoryName === name)?.score ?? 0;
              const closed = score('eyeBlinkLeft') > 0.55 && score('eyeBlinkRight') > 0.55;
              const open = score('eyeBlinkLeft') < 0.35 && score('eyeBlinkRight') < 0.35;
              const now = performance.now();
              if (closed && !eyesClosedRef.current && now - lastBlinkAtRef.current > 700) {
                setEffectIndex((prev) => stepEffect(prev, 1));
                lastBlinkAtRef.current = now;
                eyesClosedRef.current = true;
              } else if (open) {
                eyesClosedRef.current = false;
              }
            }
          }
        }

        // Always write latest known results so the overlay canvas stays smooth
        handsRef.current = lastResultsRef.current;
        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);

      // ── 4. Cleanup (returned as a side-effect via closure) ──────────────
      (video as HTMLVideoElement & { __clockitCleanup?: () => void }).__clockitCleanup = () => {
        cancelAnimationFrame(animFrameRef.current);
        landmarker.close();
        faceLandmarker.close();
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };

    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error initialising CLOCKIT.';
      setErrorMsg(message);
    }
  }, [
    videoRef,
    boxRef,
    handsRef,
    setVideoReady,
    setModelsReady,
    setErrorMsg,
    setEffectIndex,
  ]);

  return { initTracker };
}
