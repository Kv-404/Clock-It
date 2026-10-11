/** Backing-store scale shared by the WebGL view and the hand overlay. */
export function viewPixelRatio(): number {
  return Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
}

/**
 * Scale that fills the view with the camera frame without stretching it.
 * One axis stays at 1 and the other grows, so the extra is cropped.
 */
export function coverScale(
  viewWidth: number,
  viewHeight: number,
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number } {
  if (viewWidth <= 0 || viewHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return { x: 1, y: 1 };
  }
  const ratio = (videoWidth / videoHeight) / (viewWidth / viewHeight);
  if (ratio > 1) return { x: ratio, y: 1 };
  return { x: 1, y: 1 / ratio };
}
