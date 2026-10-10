import { useState, useRef, useCallback, useEffect } from 'react';
import IntroScreen    from './components/IntroScreen';
import EffectsCanvas  from './components/EffectsCanvas';
import OverlayCanvas  from './components/OverlayCanvas';
import { useHandTracker } from './hooks/useHandTracker';
import FilterPicker from './components/FilterPicker';
import { effectName, stepEffect } from './types';
import type { BoxCoords, HandData } from './types';
import DeveloperLink from './components/DeveloperLink';
import { go, requireSignIn, takeNextAction } from './lib/nav';
import { 
  uploadCapture,
  fetchCaptures,
  deleteCapture,
  signOutUser,
  onAuthChange,
} from './utils/supabase';

// ─── Custom Vector Icons (God Icons) ──────────────────────────────────────────

const IconGallery = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="21" y1="12" x2="3" y2="12" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);

const IconCamera = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconVideo = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="m22 8-6 4 6 4V8Z" />
    <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
  </svg>
);

const IconTrash = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconClose = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconWarning = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconPlay = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconCloud = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.04-1.24.12A7 7 0 0 0 3 12c0 3.87 3.13 7 7 7h7.5Z" />
  </svg>
);

const IconDownload = ({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const playDialClick = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // Ignore blockages
  }
};

// ─── CLOCKIT — Root Application ───────────────────────────────────────────────

export default function App() {
  // ── UI state ───────────────────────────────────────────────────────────────
  const [introComplete, setIntroComplete] = useState(false);
  const [videoReady,    setVideoReady]    = useState(false);
  const [modelsReady,   setModelsReady]   = useState(false);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [effectIndex,   setEffectIndex]   = useState(0);
  const [showHelp,      setShowHelp]      = useState(false);
  const [showMore,      setShowMore]      = useState(false);
  const [filterLocked,  setFilterLocked]  = useState(false);

  // ── Recording States ───────────────────────────────────────────────────────
  const [isRecording,       setIsRecording]      = useState(false);
  const [recordingSeconds,  setRecordingSeconds]  = useState(0);
  const [micEnabled,        setMicEnabled]        = useState(true);
  const [isSaving,          setIsSaving]          = useState(false);

  // ── Supabase States ────────────────────────────────────────────────────────
  const [isUploading,     setIsUploading]     = useState(false);
  const [lastUploadUrl,   setLastUploadUrl]   = useState<string | null>(null);
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [captureMode,     setCaptureMode]     = useState<'photo' | 'video'>('photo');

  // ── Auth & Gallery States ──────────────────────────────────────────────────
  const [user,            setUser]            = useState<any | null>(null);
  const [colorMode,       setColorMode]       = useState(0); // 0 = Normal, 1 = B&W, 2 = Warm, 3 = Cool
  const [backgroundMode,  setBackgroundMode]  = useState<0 | 1>(1); // 0 = Normal (color), 1 = Mono (grayscale)
  const [trackingMode,    setTrackingMode]    = useState<'hand' | 'face' | 'full'>('hand');
  const [linkCopied,      setLinkCopied]      = useState(false);
  const [showGallery,     setShowGallery]     = useState(false);
  const [shotTimer,       setShotTimer]       = useState<0 | 3>(0);
  const [countdown,       setCountdown]       = useState<number | null>(null);
  const [showGrid,        setShowGrid]        = useState(false);
  const [showFilters,     setShowFilters]     = useState(false);
  const [captures,        setCaptures]        = useState<any[]>([]);
  const [activePreview,   setActivePreview]   = useState<any | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const boxRef          = useRef<BoxCoords>([0, 0, 0, 0]);
  const handsRef        = useRef<HandData[]>([]);
  const videoRef        = useRef<HTMLVideoElement>(null);

  // ── Recording Refs ──────────────────────────────────────────────────────────
  const mediaRecorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef            = useRef<Blob[]>([]);
  const compositeIntervalRef = useRef<number | null>(null);
  const audioStreamRef       = useRef<MediaStream | null>(null);
  const recordCanvasRef      = useRef<HTMLCanvasElement | null>(null);
  const timerIntervalRef     = useRef<number | null>(null);
  const isRecordingRef       = useRef(false);
  const pendingActionRef     = useRef<null | 'photo' | 'video' | 'gallery'>(null);
  const takePhotoRef         = useRef<() => void>(() => {});
  const startRecordingRef    = useRef<() => void>(() => {});

  useEffect(() => {
    const unsubscribe = onAuthChange((supabaseUser) => {
      if (supabaseUser) {
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email
        });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch captures when user logs in
  const loadCaptures = useCallback(async () => {
    if (!user) return;
    const list = await fetchCaptures(user.id);
    
    // Filter out items older than 2 hours client-side to ensure immediate cleanup in the UI
    const now = Date.now();
    const active = list.filter((item: any) => {
      if (!item.created_at) return true;
      const ageMs = now - new Date(item.created_at).getTime();
      return ageMs < 2 * 60 * 60 * 1000;
    });
    
    setCaptures(active);
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadCaptures();
    } else {
      setCaptures([]);
    }
  }, [user, loadCaptures]);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setShowGallery(false);
  }, []);

  const handleDelete = useCallback(async (id: string, fileUrl: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this capture from your cloud portfolio?');
    if (!confirmDelete) return;

    const success = await deleteCapture(id, fileUrl);
    if (success) {
      setCaptures(prev => prev.filter(c => c.id !== id));
      if (activePreview?.id === id) {
        setActivePreview(null);
      }
    } else {
      setUploadError('Could not delete that capture. Try again.');
    }
  }, [activePreview]);

  // File download helper from cloud
  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = localUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(localUrl);
    } catch (err) {
      console.error('Download failed, opening file link directly:', err);
      window.open(url, '_blank');
    }
  };

  // ── Format time helper (mm:ss) ─────────────────────────────────────────────
  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  // ── Start Recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!user) {
      requireSignIn('video');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setUploadError('This browser cannot record video. Take a photo instead.');
      return;
    }

    const webglCanvasElement = document.getElementById('webgl-canvas');
    const webglCanvas = (webglCanvasElement?.tagName === 'CANVAS'
      ? webglCanvasElement
      : webglCanvasElement?.querySelector('canvas')) as HTMLCanvasElement | null;

    const overlayCanvasElement = document.getElementById('overlay-canvas');
    const overlayCanvas = (overlayCanvasElement?.tagName === 'CANVAS'
      ? overlayCanvasElement
      : overlayCanvasElement?.querySelector('canvas')) as HTMLCanvasElement | null;

    if (!webglCanvas) {
      setUploadError('The camera is still starting. Try again in a moment.');
      return;
    }

    try {
      chunksRef.current = [];
      setRecordingSeconds(0);

      // Create a composite canvas
      const recCanvas = document.createElement('canvas');
      recCanvas.width = webglCanvas.width;
      recCanvas.height = webglCanvas.height;
      recordCanvasRef.current = recCanvas;

      const ctx = recCanvas.getContext('2d');
      if (!ctx) return;

      isRecordingRef.current = true;
      setIsRecording(true);

      const drawComposite = () => {
        if (!isRecordingRef.current) return;
        if (recCanvas.width !== webglCanvas.width || recCanvas.height !== webglCanvas.height) {
          recCanvas.width = webglCanvas.width;
          recCanvas.height = webglCanvas.height;
        }
        ctx.drawImage(webglCanvas, 0, 0, recCanvas.width, recCanvas.height);
        if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, recCanvas.width, recCanvas.height);
        compositeIntervalRef.current = requestAnimationFrame(drawComposite);
      };

      // Draw initial frame and start loop
      ctx.drawImage(webglCanvas, 0, 0, recCanvas.width, recCanvas.height);
      if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, recCanvas.width, recCanvas.height);
      compositeIntervalRef.current = requestAnimationFrame(drawComposite);

      // Get video stream
      const canvasStream = (recCanvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(30);

      // Get audio stream if mic enabled
      let audioStream: MediaStream | null = null;
      if (micEnabled) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = audioStream;
        } catch (audioErr) {
          console.warn('Microphone permission denied or unavailable, recording video without sound.', audioErr);
        }
      }

      // Merge streams
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      }

      // Check supported recording formats (prioritizing MP4 for native compatibility)
      const mimeTypes = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      let selectedType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type;
          break;
        }
      }

      const recorder = selectedType 
        ? new MediaRecorder(combinedStream, { mimeType: selectedType, videoBitsPerSecond: 8000000 }) 
        : new MediaRecorder(combinedStream, { videoBitsPerSecond: 8000000 });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsSaving(true);
        const blob = new Blob(chunksRef.current, {
          type: selectedType || 'video/webm'
        });
        
        const ext = selectedType.includes('mp4') ? 'mp4' : 'webm';
        const filename = `clock-it-capture-${Date.now()}.${ext}`;

        // DIRECT CLOUD UPLOAD (NO LOCAL DOWNLOAD)
        if (user) {
          setIsUploading(true);
          setLastUploadUrl(null);
          setUploadError(null);
          const filterName = effectName(effectIndex);
          
          const { publicUrl, error } = await uploadCapture(blob, filename, 'video', filterName, user.id);
          
          setIsUploading(false);
          setIsSaving(false);
          if (error) {
            setUploadError(error);
            console.error('[CLOCKIT] Supabase upload failed:', error);
          } else {
            setLastUploadUrl(publicUrl);
            console.log('[CLOCKIT] Supabase upload succeeded:', publicUrl);
            void loadCaptures();
          }
        } else {
          setIsSaving(false);
          setUploadError('Sign in again before saving a video.');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect chunk data every 1s

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting video capture:', err);
      setUploadError('Could not start recording. Allow the camera and microphone, then try again.');
      isRecordingRef.current = false;
      setIsRecording(false);
      if (compositeIntervalRef.current !== null) {
        cancelAnimationFrame(compositeIntervalRef.current);
      }
    }
  }, [micEnabled, effectIndex, user, loadCaptures]);

  // ── Stop Recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (compositeIntervalRef.current !== null) {
      cancelAnimationFrame(compositeIntervalRef.current);
      compositeIntervalRef.current = null;
    }

    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  // ── Take Photo Capture ──────────────────────────────────────────────────────
  const takePhoto = useCallback(() => {
    if (!user) {
      requireSignIn('photo');
      return;
    }
    if (shotTimer > 0 && countdown === null) {
      let left = shotTimer;
      setCountdown(left);
      const timerId = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          window.clearInterval(timerId);
          setCountdown(null);
          takePhotoRef.current();
        } else {
          setCountdown(left);
        }
      }, 1000);
      return;
    }
    const webglCanvasElement = document.getElementById('webgl-canvas');
    const webglCanvas = (webglCanvasElement?.tagName === 'CANVAS'
      ? webglCanvasElement
      : webglCanvasElement?.querySelector('canvas')) as HTMLCanvasElement | null;

    const overlayCanvasElement = document.getElementById('overlay-canvas');
    const overlayCanvas = (overlayCanvasElement?.tagName === 'CANVAS'
      ? overlayCanvasElement
      : overlayCanvasElement?.querySelector('canvas')) as HTMLCanvasElement | null;

    if (!webglCanvas) {
      setUploadError('The camera is still starting. Try again in a moment.');
      return;
    }

    try {
      // Create a temporary composite canvas
      const photoCanvas = document.createElement('canvas');
      photoCanvas.width = webglCanvas.width;
      photoCanvas.height = webglCanvas.height;

      const ctx = photoCanvas.getContext('2d');
      if (!ctx) return;

      // Draw WebGL and overlay canvases scaled
      ctx.drawImage(webglCanvas, 0, 0, photoCanvas.width, photoCanvas.height);
      if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, photoCanvas.width, photoCanvas.height);

      // Convert to blob so we can save it and upload it
      photoCanvas.toBlob(async (blob) => {
        if (!blob) {
          setUploadError('Could not capture that photo. Try again.');
          return;
        }

        const filename = `clock-it-photo-${Date.now()}.png`;

        // DIRECT CLOUD UPLOAD (NO LOCAL DOWNLOAD)
        if (user) {
          setIsUploading(true);
          setLastUploadUrl(null);
          setUploadError(null);
          const filterName = effectName(effectIndex);
          
          const { publicUrl, error } = await uploadCapture(blob, filename, 'photo', filterName, user.id);
          
          setIsUploading(false);
          if (error) {
            setUploadError(error);
            console.error('[CLOCKIT] Supabase photo upload failed:', error);
          } else {
            setLastUploadUrl(publicUrl);
            console.log('[CLOCKIT] Supabase photo upload succeeded:', publicUrl);
            void loadCaptures();
          }
        } else {
          setUploadError('Sign in again before saving a photo.');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error taking photo:', err);
      setUploadError('Could not capture that photo. Try again.');
    }
  }, [effectIndex, user, loadCaptures, shotTimer, countdown]);

  takePhotoRef.current = takePhoto;
  startRecordingRef.current = startRecording;

  useEffect(() => {
    if (!user) return;
    const action = pendingActionRef.current ?? takeNextAction();
    pendingActionRef.current = null;
    if (!action) return;
    if (action === 'gallery') setShowGallery(true);
    if (action === 'photo') takePhotoRef.current();
    if (action === 'video') void startRecordingRef.current();
  }, [user]);

  // ── Hand tracker ───────────────────────────────────────────────────────────
  const { initTracker } = useHandTracker({
    videoRef,
    boxRef,
    handsRef,
    setVideoReady,
    setModelsReady,
    setErrorMsg,
    setEffectIndex,
    filterLocked,
    trackingMode,
  });

  // ── Start the camera as soon as the intro finishes. Sign-in is not required.
  useEffect(() => {
    if (!introComplete) return;
    void initTracker();
  }, [introComplete, initTracker]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    const videoEl = videoRef.current;
    return () => {
      const video = videoEl as
        (HTMLVideoElement & { __clockitCleanup?: () => void }) | null;
      video?.__clockitCleanup?.();

      isRecordingRef.current = false;
      if (compositeIntervalRef.current !== null) {
        cancelAnimationFrame(compositeIntervalRef.current);
      }
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef]);

  // ── Retry ──────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    setVideoReady(false);
    setModelsReady(false);
    void initTracker();
  }, [initTracker]);

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isLoading = introComplete && (!videoReady || !modelsReady) && !errorMsg;
  const isActive  = introComplete &&  videoReady  &&  modelsReady  && !errorMsg;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-black overflow-hidden w-screen h-screen relative">
      <DeveloperLink />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&display=swap"
      />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100vw', height: '100vh',
          opacity: 0,
          pointerEvents: 'none',
          objectFit: 'cover',
          zIndex: 0
        }}
        aria-hidden="true"
      />

      {/* ── Intro (auto-dismisses after 2.6 s) ────────────────────────────── */}
      {!introComplete && (
        <IntroScreen onComplete={() => setIntroComplete(true)} />
      )}

      {/* ── Auth sheet. The studio stays usable until a save or the gallery. ─ */}
      {/* ── Loading Tracker Screen ─────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            background: '#000000 radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)',
          }}
          aria-live="polite"
        >
          <style>{`
            @keyframes clockitLoadRing {
              0%   { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes clockitLoadPulse {
              0%, 100% { opacity: 0.15; transform: scale(1); }
              50%      { opacity: 0.3; transform: scale(1.05); }
            }
            @keyframes clockitLoadTextFade {
              0%, 100% { opacity: 0.3; }
              50%      { opacity: 0.6; }
            }
          `}</style>

          {/* Pulsing ring loader */}
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            marginBottom: '32px',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.04)',
              animation: 'clockitLoadPulse 3s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid transparent',
              borderTopColor: 'rgba(255,255,255,0.4)',
              animation: 'clockitLoadRing 1.5s linear infinite',
            }} role="status" />
          </div>

          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: '20px',
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            Clock It
          </p>

          <div style={{
            width: '40px',
            height: '1px',
            background: 'rgba(255,255,255,0.08)',
            marginBottom: '16px',
          }} />

          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
              animation: 'clockitLoadTextFade 2.5s ease-in-out infinite',
            }}
          >
            {videoReady ? 'Calibrating Synthesis Engine' : 'Requesting Camera Input'}
          </p>
        </div>
      )}

      {/* ── Error Screen ─────────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center px-8"
          style={{ background: '#050505' }}
          role="alert"
        >
          <IconWarning size={32} color="rgb(248,113,113)" />
          <p
            className="font-mono text-xs max-w-sm"
            style={{ color: 'rgba(252,165,165,0.7)', letterSpacing: '0.05em', lineHeight: 1.7 }}
          >
            {errorMsg}
          </p>
          <button
            onClick={handleRetry}
            className="mt-2 px-5 py-2 font-mono text-xs tracking-widest uppercase rounded transition-colors"
            style={{
              border:     '1px solid rgba(248,113,113,0.2)',
              color:      'rgba(248,113,113,0.6)',
              background: 'transparent',
              cursor:     'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Active Visual Studio Studio ─────────────────────────────────────── */}
      {isActive && (
        <>
          <EffectsCanvas
            videoRef={videoRef}
            boxRef={boxRef}
            effectIndex={effectIndex}
            colorMode={colorMode}
            backgroundMode={backgroundMode}
            borderEnabled={trackingMode === 'full' ? 0 : 1}
          />
          {trackingMode === 'hand' && (
            <OverlayCanvas
              handsRef={handsRef}
              videoRef={videoRef}
            />
          )}

          {/* User Account HUD (Top-Left) */}
          <div style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top))',
            left: 'max(16px, env(safe-area-inset-left))',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontFamily: 'monospace',
            fontSize: '9px',
            letterSpacing: '0.12em',
            color: 'rgba(255, 255, 255, 0.5)',
            background: 'transparent',
            padding: 0,
            border: 'none',
          }}>
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                title={user.email}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(5,5,5,0.45)',
                  color: 'rgba(255,255,255,0.75)',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                }}
              >
                LOG OUT
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go('/login')}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(5,5,5,0.45)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                }}
              >
                SIGN IN
              </button>
            )}
          </div>

          {/* Help Toggle Button (Top-Right) */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              position: 'fixed',
              top: 'max(16px, env(safe-area-inset-top))',
              right: 'max(16px, env(safe-area-inset-right))',
              zIndex: 30,
              background: 'rgba(5,5,5,0.4)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '4px',
              padding: '8px 12px',
              color: showHelp ? '#fff' : 'rgba(255, 255, 255, 0.4)',
              fontFamily: 'monospace',
              fontSize: '9px',
              cursor: 'pointer',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.2s ease',
            }}
          >
            {showHelp ? 'Hide' : '?'}
          </button>

          {/* Guide Overlay Banner */}
          {showHelp && (
            <div style={{
              position: 'fixed',
              top: 'max(72px, calc(env(safe-area-inset-top) + 56px))',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              background: 'rgba(5,5,5,0.4)',
              padding: '8px 16px',
              borderRadius: '4px',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontFamily: 'monospace',
              fontSize: '10px',
              letterSpacing: '0.12em',
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              textAlign: 'center',
              maxWidth: 'min(92vw, 640px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <span>Face mode: blink to change the filter. Pinch still works in hands mode.</span>
            </div>
          )}

          {showGrid && (
            <div
              aria-hidden="true"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 12,
                pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px)',
                backgroundSize: '33.33% 33.33%',
                backgroundPosition: 'center',
              }}
            />
          )}

          {countdown !== null && (
            <div
              aria-live="assertive"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 35,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.25)',
                color: '#fff',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '120px',
                pointerEvents: 'none',
              }}
            >
              {countdown}
            </div>
          )}

          {/* Unified Slim Camera Control Dock */}
          <div style={{
            position: 'fixed',
            bottom: 'max(10px, env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
            maxWidth: '96vw',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'monospace',
          }}>
            {showFilters && (
              <FilterPicker
                videoRef={videoRef}
                effectIndex={effectIndex}
                onSelect={(id) => {
                  setEffectIndex(id);
                  playDialClick();
                }}
              />
            )}

            {showMore && (
              <div className="clockit-chip-row" style={{ maxWidth: '96vw', background: 'rgba(5,5,5,0.55)', borderRadius: '999px', padding: '4px 8px' }}>
                {trackingMode !== 'full' && (
                  <button type="button" className="clockit-chip clockit-chip-slim" aria-pressed={backgroundMode === 0} onClick={() => setBackgroundMode(backgroundMode === 0 ? 1 : 0)}>
                    {backgroundMode === 0 ? 'Color' : 'Mono'}
                  </button>
                )}
                {['Normal', 'Mono', 'Warm', 'Cool'].map((name, val) => (
                  <button key={name} type="button" className="clockit-chip clockit-chip-slim" aria-pressed={colorMode === val} onClick={() => setColorMode(val)}>
                    {name}
                  </button>
                ))}
                <button type="button" className="clockit-chip clockit-chip-slim" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>Grid</button>
                <button type="button" className="clockit-chip clockit-chip-slim" aria-pressed={shotTimer === 3} onClick={() => setShotTimer(v => v === 3 ? 0 : 3)}>
                  {shotTimer === 3 ? '3s' : 'Timer'}
                </button>
                <button type="button" className="clockit-chip clockit-chip-slim" aria-pressed={filterLocked} onClick={() => setFilterLocked(v => !v)}>
                  {filterLocked ? 'Locked' : 'Lock'}
                </button>
                <button type="button" className="clockit-chip clockit-chip-slim" aria-pressed={!micEnabled} disabled={isRecording} onClick={() => setMicEnabled(v => !v)}>
                  {micEnabled ? 'Mic' : 'Muted'}
                </button>
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '48px',
              padding: '0 8px 0 10px',
              background: 'rgba(5, 5, 5, 0.55)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
            }}>
              <button
                type="button"
                className="clockit-text-btn"
                onClick={() => {
                  const order = ['hand', 'face', 'full'] as const;
                  const next = order[(order.indexOf(trackingMode) + 1) % order.length];
                  setTrackingMode(next);
                  playDialClick();
                }}
              >
                {trackingMode === 'hand' ? 'Hands' : trackingMode === 'face' ? 'Face' : 'Full'}
              </button>

              <button
                type="button"
                className="clockit-text-btn"
                aria-label="Previous filter"
                onClick={() => setEffectIndex(stepEffect(effectIndex, -1))}
              >
                ‹
              </button>
              <button
                type="button"
                className="clockit-text-btn"
                aria-expanded={showFilters}
                aria-label="Show all filters"
                onClick={() => setShowFilters((open) => !open)}
                style={{ maxWidth: '108px', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {effectName(effectIndex)}
              </button>
              <button
                type="button"
                className="clockit-text-btn"
                aria-label="Next filter"
                onClick={() => setEffectIndex(stepEffect(effectIndex, 1))}
              >
                ›
              </button>

              <button
                type="button"
                aria-label={captureMode === 'photo' ? 'Take photo' : isRecording ? 'Stop recording' : 'Start recording'}
                onClick={captureMode === 'photo' ? takePhoto : (isRecording ? stopRecording : startRecording)}
                disabled={isSaving || isUploading}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'transparent',
                  border: '1.5px solid #fff',
                  borderRadius: '50%',
                  cursor: (isSaving || isUploading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <span style={{
                  width: isRecording ? '12px' : '24px',
                  height: isRecording ? '12px' : '24px',
                  borderRadius: isRecording ? '2px' : '50%',
                  backgroundColor: (captureMode === 'video' || isRecording) ? '#ff4a4a' : '#fff',
                }} />
              </button>

              <button
                type="button"
                className="clockit-text-btn"
                aria-label={captureMode === 'photo' ? 'Switch to video' : 'Switch to photo'}
                disabled={isRecording}
                onClick={() => setCaptureMode(captureMode === 'photo' ? 'video' : 'photo')}
              >
                {captureMode === 'photo' ? <IconCamera size={14} /> : <IconVideo size={14} />}
              </button>

              <button
                type="button"
                className="clockit-text-btn"
                onClick={() => {
                  if (!user) {
                    requireSignIn('gallery');
                    return;
                  }
                  setShowGallery(true);
                }}
                aria-label="Open gallery"
              >
                <IconGallery size={14} />
              </button>

              <button
                type="button"
                className="clockit-text-btn"
                aria-pressed={showMore}
                aria-label="More controls"
                onClick={() => setShowMore(v => !v)}
              >
                ···
              </button>
            </div>

            {/* Recording timer overlay inside the dock */}
            {isRecording && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#ff4a4a',
                fontSize: '8px',
                fontWeight: 'bold',
                marginTop: '2px',
              }}>
                <span style={{
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  backgroundColor: '#ff4a4a',
                  animation: 'pulse-btn 1s infinite',
                }} />
                <span>REC {formatTime(recordingSeconds)}</span>
              </div>
            )}
          </div>

          {/* Cloud Upload Notification (Top-Right under Toggle HUD button) */}
          {(isUploading || lastUploadUrl || uploadError) && (
            <div
              style={{
                position: 'fixed',
                top: '84px',
                right: '24px',
                zIndex: 30,
                background: 'rgba(5, 5, 5, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid ' + (uploadError ? 'rgba(255,74,74,0.2)' : 'rgba(255, 255, 255, 0.05)'),
                borderRadius: '4px',
                padding: '12px 16px',
                width: '210px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                animation: 'fadeIn 0.2s ease-out',
                fontFamily: 'monospace',
              }}
            >
              {isUploading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="upload-spinner" style={{
                    width: '8px',
                    height: '8px',
                    border: '1.5px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'clockitLoadRing 1s linear infinite',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>UPLOADING TO PORTFOLIO...</span>
                </div>
              )}
              
              {lastUploadUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 'bold', letterSpacing: '0.05em' }}>✓ UPLOAD SUCCESSFUL</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(lastUploadUrl).then(() => {
                          setLinkCopied(true);
                          window.setTimeout(() => setLinkCopied(false), 1600);
                        });
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        borderRadius: '3px',
                        padding: '4px 6px',
                        fontSize: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                      }}
                    >
                      {linkCopied ? 'COPIED' : 'COPY LINK'}
                    </button>
                    <a
                      href={lastUploadUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        background: '#fff',
                        color: '#000',
                        textDecoration: 'none',
                        borderRadius: '3px',
                        padding: '4px 6px',
                        fontSize: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      VIEW
                    </a>
                  </div>
                </div>
              )}

              {uploadError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#ff4a4a', fontWeight: 'bold' }}>✕ UPLOAD FAILED</span>
                  <span style={{ fontSize: '8px', color: 'rgba(255,74,74,0.6)', lineHeight: 1.4 }}>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* Cloud Gallery Overlay */}
          {showGallery && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(20px)',
                zIndex: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <div
                style={{
                  background: 'rgba(10, 10, 10, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  width: '90%',
                  maxWidth: '720px',
                  maxHeight: '80vh',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  gap: '20px',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', letterSpacing: '0.2em', color: '#fff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconCloud size={14} color="#fff" />
                    <span>Cloud Portfolio</span>
                  </h3>
                  <button
                    onClick={() => setShowGallery(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '10px',
                      cursor: 'pointer',
                      letterSpacing: '0.12em',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                  >
                    <IconClose size={12} />
                    <span>Close</span>
                  </button>
                </div>

                {/* Content Grid */}
                <div
                  className="custom-scrollbar"
                  style={{
                    overflowY: 'auto',
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '16px',
                    paddingRight: '4px',
                  }}
                >
                  {captures.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.25)', fontSize: '10px', letterSpacing: '0.15em' }}>
                      NO CLOUD CAPTURES FOUND
                    </div>
                  ) : (
                    captures.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                          transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
                      >
                        {/* Media Box */}
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '16/9',
                            background: '#030303',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                          onClick={() => setActivePreview(item)}
                        >
                          {item.type === 'photo' ? (
                            <img
                              src={item.file_url}
                              alt={item.filter_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <IconPlay size={20} color="rgba(255,255,255,0.6)" />
                              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>VIDEO RECORDING</span>
                            </div>
                          )}
                        </div>

                        {/* Description & Trash */}
                        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                            <span style={{ fontSize: '8px', fontWeight: 'bold', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.filter_name || 'ORIGINAL'}
                            </span>
                            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)' }}>
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleDelete(item.id, item.file_url)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255,74,74,0.5)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ff4a4a'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,74,74,0.5)'}
                            title="Delete Capture"
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active Preview Modal (Lightbox) */}
          {activePreview && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
                backdropFilter: 'blur(20px)',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.2s ease-out',
                fontFamily: 'monospace',
              }}
              onClick={() => setActivePreview(null)}
            >
              <div
                style={{
                  position: 'relative',
                  width: '90%',
                  maxWidth: '800px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Media Container */}
                <div style={{ width: '100%', maxHeight: '72vh', overflow: 'hidden', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                  {activePreview.type === 'photo' ? (
                    <img
                      src={activePreview.file_url}
                      alt={activePreview.filter_name}
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '68vh', objectFit: 'contain' }}
                    />
                  ) : (
                    <video
                      src={activePreview.file_url}
                      controls
                      autoPlay
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '68vh' }}
                    />
                  )}
                </div>

                {/* Lightbox Footer Controls */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '9px', padding: '0 4px', letterSpacing: '0.05em' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span>FILTER: <strong style={{ color: '#fff' }}>{activePreview.filter_name || 'ORIGINAL'}</strong></span>
                    <span>TYPE: <strong style={{ color: '#fff' }}>{activePreview.type.toUpperCase()}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button
                      onClick={() => downloadFile(activePreview.file_url, activePreview.filename || 'capture.png')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <IconDownload size={11} />
                      <span>DOWNLOAD</span>
                    </button>
                    <button
                      onClick={() => setActivePreview(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                    >
                      <IconClose size={11} />
                      <span>CLOSE</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
