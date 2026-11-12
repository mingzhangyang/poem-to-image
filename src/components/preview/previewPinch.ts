export interface PreviewPoint { x: number; y: number }
export interface PreviewPinchStart { distance: number; zoom: number }

/** Ignore coincident or invalid pointers until a usable baseline is available. */
export function previewPointerDistance(first: PreviewPoint, second: PreviewPoint): number | null {
  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  return Number.isFinite(distance) && distance >= 0.5 ? distance : null;
}

export function previewPinchZoom(start: PreviewPinchStart, distance: number, min: number, max: number): number | null {
  if (!Number.isFinite(start.distance) || start.distance < 0.5 || !Number.isFinite(start.zoom)
    || !Number.isFinite(distance) || distance < 0 || !Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  const zoom = start.zoom * distance / start.distance;
  return Number.isFinite(zoom) ? Math.min(max, Math.max(min, zoom)) : null;
}
