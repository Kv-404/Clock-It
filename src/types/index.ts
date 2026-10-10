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

/** Shader ids worth keeping. Gimmicks such as kaleidoscope stay out of this list. */
export const EFFECTS = [
  { id: 0, name: 'Burning Inferno' },
  { id: 1, name: 'Neon Silhouette' },
  { id: 2, name: 'Thermal Vision' },
  { id: 4, name: 'Glitch Signal' },
  { id: 5, name: 'Neon Edges' },
  { id: 6, name: 'Constellation' },
  { id: 7, name: 'Vaporwave Dream' },
  { id: 8, name: 'Retro CRT' },
  { id: 9, name: 'Vintage Polaroid' },
  { id: 10, name: 'Cyberpunk Edge' },
  { id: 14, name: 'Comic Halftone' },
  { id: 16, name: 'Sin City Red' },
  { id: 17, name: 'GameBoy Retro' },
  { id: 20, name: 'Night Vision' },
  { id: 25, name: 'Ink Duotone' },
  { id: 26, name: 'Prism Split' },
  { id: 27, name: 'Soft Bloom' },
  { id: 28, name: 'Poster Pop' },
  { id: 29, name: 'Hologram' },
  { id: 30, name: 'Noir Grain' },
  { id: 31, name: 'Infrared' },
  { id: 32, name: 'Light Leak' },
  { id: 33, name: 'Candy' },
  { id: 34, name: 'Blueprint' },
  { id: 35, name: 'Gold' },
  { id: 36, name: 'X-Ray' },
  { id: 37, name: 'Pastel' },
  { id: 38, name: 'Pop Art' },
  { id: 39, name: 'Sunset' },
  { id: 40, name: 'Chrome' },
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
