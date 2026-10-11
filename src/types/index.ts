// ─── CLOCKIT — Type Definitions ───────────────────────────────────────────────

/**
 * Global hand-tracking lifecycle state.
 * Used to coordinate UI states (intro → loading → ready / error).
 */
export interface HandTrackingState {
  videoReady: boolean;
  modelsReady: boolean;
  errorMsg: string | null;
}

/**
 * Bounding box for the detected hand region in normalised [0, 1] coordinates.
 * Tuple order: [xMin, yMin, xMax, yMax]
 */
export type BoxCoords = [
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
];

/**
 * A single MediaPipe hand landmark point in normalised 3-D space.
 * x, y ∈ [0, 1] (image fraction); z is relative depth (negative = toward camera).
 */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * All data for one detected hand in a single frame.
 */
export interface HandData {
  /** 21 landmarks as returned by MediaPipe HandLandmarker */
  landmarks: LandmarkPoint[];
  /** Which physical hand was detected */
  handedness: 'Left' | 'Right';
}

/** Selectable studio filters. Ids match the branches in fragment.glsl. */
export const EFFECTS = [
  { id: 0, name: 'CRT' },
  { id: 1, name: 'Receipt' },
  { id: 2, name: 'Depth Map' },
  { id: 3, name: 'Datamosh' },
  { id: 4, name: 'Pixel Sort' },
  { id: 5, name: 'Slit Scan' },
  { id: 6, name: 'Echo' },
  { id: 7, name: 'Data Bend' },
  { id: 8, name: '1-Bit Dither' },
  { id: 9, name: 'Night Vision' },
  { id: 10, name: 'Quadtree' },
  { id: 11, name: 'VHS' },
  { id: 12, name: 'ASCII' },
  { id: 13, name: 'Halftone' },
  { id: 14, name: 'Thermal' },
  { id: 15, name: 'Color Dither' },
] as const;

export type EffectName = typeof EFFECTS[number]['name'];

export function effectName(id: number): string {
  return EFFECTS.find((effect) => effect.id === id)?.name ?? EFFECTS[0].name;
}

export function stepEffect(id: number, direction: 1 | -1): number {
  const index = EFFECTS.findIndex((effect) => effect.id === id);
  const next = index < 0 ? 0 : index + direction;
  return EFFECTS[(next + EFFECTS.length) % EFFECTS.length].id;
}
