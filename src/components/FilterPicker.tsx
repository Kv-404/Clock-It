import { useEffect, useRef, type MutableRefObject } from 'react';
import { EFFECTS } from '../types';

const PREVIEW: Record<number, string> = {
  0: 'contrast(1.35) saturate(1.7) sepia(0.65)',
  1: 'contrast(1.9) saturate(2) brightness(1.15)',
  2: 'hue-rotate(300deg) saturate(2.2) contrast(1.25)',
  4: 'contrast(1.5) saturate(0.15)',
  5: 'grayscale(1) contrast(2.2)',
  6: 'grayscale(1) brightness(0.55) contrast(1.4)',
  7: 'hue-rotate(280deg) saturate(1.6) contrast(1.1)',
  8: 'contrast(1.15) saturate(0.8)',
  9: 'sepia(0.5) contrast(0.95) saturate(0.85)',
  10: 'contrast(1.45) saturate(1.5) hue-rotate(190deg)',
  14: 'contrast(1.7) saturate(1.35)',
  16: 'grayscale(1) contrast(1.45)',
  17: 'sepia(0.4) hue-rotate(55deg) saturate(0.45) contrast(1.15)',
  20: 'brightness(1.25) sepia(0.5) hue-rotate(70deg) saturate(1.5)',
  25: 'grayscale(1) contrast(1.35)',
  26: 'contrast(1.25) saturate(1.8)',
  27: 'brightness(1.18) contrast(0.92) saturate(1.1)',
  28: 'contrast(1.9) saturate(1.45)',
  30: 'grayscale(1) contrast(1.55) brightness(0.88)',
  31: 'hue-rotate(320deg) saturate(1.9) contrast(1.2)',
  32: 'sepia(0.35) saturate(1.25) brightness(1.08)',
};

function paintPreview(canvas: HTMLCanvasElement, video: HTMLVideoElement, effectId: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || video.videoWidth === 0) return;
  ctx.filter = PREVIEW[effectId] ?? 'none';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  if (effectId === 16) {
    ctx.fillStyle = 'rgba(180, 0, 0, 0.28)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

export default function FilterPicker({
  videoRef,
  effectIndex,
  onSelect,
}: {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  effectIndex: number;
  onSelect: (id: number) => void;
}) {
  const tiles = useRef<Record<number, HTMLCanvasElement | null>>({});

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const draw = () => {
      frame += 1;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && frame % 6 === 0) {
        for (const effect of EFFECTS) {
          const canvas = tiles.current[effect.id];
          if (canvas) paintPreview(canvas, video, effect.id);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  return (
    <div className="clockit-filter-grid" role="listbox" aria-label="Filters">
      {EFFECTS.map((effect) => (
        <button
          key={effect.id}
          type="button"
          role="option"
          aria-selected={effect.id === effectIndex}
          className={effect.id === effectIndex ? 'clockit-filter-tile is-active' : 'clockit-filter-tile'}
          onClick={() => onSelect(effect.id)}
        >
          <canvas
            ref={(node) => { tiles.current[effect.id] = node; }}
            width={160}
            height={120}
          />
          <span>{effect.name}</span>
        </button>
      ))}
    </div>
  );
}
