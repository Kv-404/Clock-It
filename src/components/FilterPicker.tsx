import { useEffect, useRef, type MutableRefObject } from 'react';
import { EFFECTS } from '../types';

const PREVIEW: Record<number, string> = {
  0: 'contrast(1.12) saturate(0.9) brightness(0.92)',
  1: 'grayscale(1) contrast(1.7) sepia(0.28) brightness(1.12)',
  2: 'saturate(1.6) hue-rotate(190deg) contrast(1.25)',
  3: 'contrast(1.25) saturate(1.35) hue-rotate(18deg)',
  4: 'contrast(1.2) saturate(1.3)',
  5: 'contrast(1.15) saturate(1.1)',
  6: 'contrast(1.05) brightness(1.08) saturate(1.15)',
  7: 'contrast(1.35) saturate(1.5) hue-rotate(40deg)',
  8: 'grayscale(1) contrast(3.2)',
  9: 'brightness(1.15) sepia(1) hue-rotate(70deg) saturate(2.4) contrast(1.15)',
  10: 'contrast(1.35) saturate(0.95)',
  11: 'contrast(0.92) saturate(0.72) sepia(0.18) brightness(1.04)',
  12: 'contrast(1.45) brightness(0.82) saturate(0.7)',
  13: 'contrast(1.15) saturate(0.75)',
  14: 'contrast(1.3) saturate(1.6) hue-rotate(330deg)',
  15: 'contrast(1.45) saturate(1.15)',
};

function paintPreview(canvas: HTMLCanvasElement, video: HTMLVideoElement, effectId: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || video.videoWidth === 0) return;
  ctx.filter = PREVIEW[effectId] ?? 'none';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
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
