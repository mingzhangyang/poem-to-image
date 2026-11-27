import { isInsetBorderStyle } from './borderUtils';
import type { BorderStyle, PositionedElement } from './types';

export interface PreviewPositioningRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasPositioningRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragBounds {
  minPositionX: number;
  maxPositionX: number;
  minPositionY: number;
  maxPositionY: number;
}

export interface RelativePosition {
  positionX: number;
  positionY: number;
}

export type ArrowDirection = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

// A measured export origin is valid only for the text box dimensions at
// measurement time, regardless of whether a new font finished loading.
export interface FontLayoutMeasurement {
  revision: number;
  width: number;
  height: number;
}

export function didTextBoxDimensionsChange(
  previous: Pick<FontLayoutMeasurement, 'width' | 'height'>,
  current: Pick<FontLayoutMeasurement, 'width' | 'height'>,
): boolean {
  return previous.width !== current.width || previous.height !== current.height;
}

export function didFontReadyChangeTextBox(
  previous: FontLayoutMeasurement,
  current: FontLayoutMeasurement,
): boolean {
  return previous.revision !== current.revision
    && didTextBoxDimensionsChange(previous, current);
}

export function isArrowDirection(key: string): key is ArrowDirection {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
}

export const KEYBOARD_MOVE_STEP = 1;
export const KEYBOARD_MOVE_STEP_FAST = 3;
export const KEYBOARD_RESIZE_STEP = 2;

export function clampPosition(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseBorderWidth(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Browser coordinates are post-CSS-transform pixels. Computed border widths
 * and offset dimensions are pre-transform CSS pixels. Convert both axes to
 * screen pixels before extracting the content box (including preview zoom).
 */
export function getPreviewPositioningRect(element: HTMLElement): PreviewPositioningRect {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const scaleX = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
  const scaleY = element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1;
  const leftBorder = parseBorderWidth(style.borderLeftWidth) * scaleX;
  const rightBorder = parseBorderWidth(style.borderRightWidth) * scaleX;
  const topBorder = parseBorderWidth(style.borderTopWidth) * scaleY;
  const bottomBorder = parseBorderWidth(style.borderBottomWidth) * scaleY;
  return {
    left: rect.left + leftBorder,
    top: rect.top + topBorder,
    width: Math.max(1, rect.width - leftBorder - rightBorder),
    height: Math.max(1, rect.height - topBorder - bottomBorder),
  };
}

export function getCanvasPositioningRect(
  contentRect: CanvasPositioningRect,
  showBorder: boolean,
  borderStyle: BorderStyle,
  borderWidth: number,
): CanvasPositioningRect {
  const safeBorderWidth = Number.isFinite(borderWidth) ? Math.max(2, borderWidth) : 4;
  const inset = showBorder && isInsetBorderStyle(borderStyle) ? safeBorderWidth : 0;
  return {
    x: contentRect.x + inset,
    y: contentRect.y + inset,
    width: Math.max(1, contentRect.width - inset * 2),
    height: Math.max(1, contentRect.height - inset * 2),
  };
}

export function getPreviewDragBounds(frameRect: PreviewPositioningRect, boxRect: Pick<DOMRect, 'width' | 'height'>): DragBounds {
  const halfWidthPercent = Math.min(50, Math.max(0, (boxRect.width / 2 / frameRect.width) * 100));
  const halfHeightPercent = Math.min(50, Math.max(0, (boxRect.height / 2 / frameRect.height) * 100));
  return {
    minPositionX: halfWidthPercent,
    maxPositionX: 100 - halfWidthPercent,
    minPositionY: halfHeightPercent,
    maxPositionY: 100 - halfHeightPercent,
  };
}

/**
 * The whole artwork canvas, padding included, for a positioning frame inside
 * it. Canvas padding keeps text off the paper edge; images such as logos and
 * ornaments may use it, so they are limited by this rect instead.
 */
export function getArtworkCanvasRect(frameElement: HTMLElement): PreviewPositioningRect {
  const canvas = frameElement.closest<HTMLElement>('[data-artwork-canvas]');
  if (!canvas) return getPreviewPositioningRect(frameElement);
  const { left, top, width, height } = canvas.getBoundingClientRect();
  return { left, top, width: Math.max(1, width), height: Math.max(1, height) };
}

/**
 * Drag bounds for a box whose position is a point other than its centre,
 * such as an ornament positioned by its image centre whose visible ink is
 * off-centre. Positions stay percentages of `frameRect`, but the box is kept
 * inside `limitRect` (the frame itself unless given), so a position may fall
 * below 0% or above 100% when the limit is larger than the frame. A box
 * larger than the limit on an axis is centred in it on that axis.
 */
export function getAnchoredDragBounds(
  frameRect: PreviewPositioningRect,
  boxRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  anchor: { x: number; y: number },
  limitRect: PreviewPositioningRect = frameRect,
): DragBounds {
  const axis = (before: number, after: number, frameStart: number, frameSize: number, limitStart: number, limitSize: number) => {
    const toPercent = (point: number) => ((point - frameStart) / frameSize) * 100;
    const min = toPercent(limitStart + Math.max(0, before));
    const max = toPercent(limitStart + limitSize - Math.max(0, after));
    return min <= max ? [min, max] : [(min + max) / 2, (min + max) / 2];
  };
  const [minPositionX, maxPositionX] = axis(
    anchor.x - boxRect.left, boxRect.right - anchor.x, frameRect.left, frameRect.width, limitRect.left, limitRect.width,
  );
  const [minPositionY, maxPositionY] = axis(
    anchor.y - boxRect.top, boxRect.bottom - anchor.y, frameRect.top, frameRect.height, limitRect.top, limitRect.height,
  );
  return { minPositionX, maxPositionX, minPositionY, maxPositionY };
}

const DEFAULT_DRAG_BOUNDS: DragBounds = {
  minPositionX: 0,
  maxPositionX: 100,
  minPositionY: 0,
  maxPositionY: 100,
};

export function getKeyboardDragBounds(
  frameRect: PreviewPositioningRect | null,
  boxRect: Pick<DOMRect, 'width' | 'height'> | null | undefined,
): DragBounds {
  return frameRect && boxRect ? getPreviewDragBounds(frameRect, boxRect) : DEFAULT_DRAG_BOUNDS;
}

export function clampToDragBounds(position: RelativePosition, bounds: DragBounds): RelativePosition {
  return {
    positionX: clampPosition(position.positionX, bounds.minPositionX, bounds.maxPositionX),
    positionY: clampPosition(position.positionY, bounds.minPositionY, bounds.maxPositionY),
  };
}

/** One pointer-delta projection for poem, text, logo, stamp and signature. */
export function movePreviewPosition(
  start: RelativePosition,
  pointerDelta: { x: number; y: number },
  frameRect: PreviewPositioningRect,
  bounds: DragBounds,
): RelativePosition {
  return clampToDragBounds({
    positionX: start.positionX + (pointerDelta.x / frameRect.width) * 100,
    positionY: start.positionY + (pointerDelta.y / frameRect.height) * 100,
  }, bounds);
}

/** One arrow-key nudge projection. Shift accelerates 1% to 3%. */
export function nudgePreviewPosition(
  position: RelativePosition,
  key: ArrowDirection,
  shiftKey: boolean,
  bounds: DragBounds,
): RelativePosition {
  const step = shiftKey ? KEYBOARD_MOVE_STEP_FAST : KEYBOARD_MOVE_STEP;
  return clampToDragBounds({
    positionX: position.positionX + (key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0),
    positionY: position.positionY + (key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0),
  }, bounds);
}

/**
 * Read back real DOM geometry after a resize/drag so Canvas and the preview
 * share the same normalized center and top-left metadata.
 */
export function measurePreviewElement(
  frameRect: PreviewPositioningRect,
  boxRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
): Pick<PositionedElement, 'positionX' | 'positionY' | 'exportLeft' | 'exportTop'> {
  return {
    positionX: clampPosition((((boxRect.left + boxRect.right) / 2 - frameRect.left) / frameRect.width) * 100, 0, 100),
    positionY: clampPosition((((boxRect.top + boxRect.bottom) / 2 - frameRect.top) / frameRect.height) * 100, 0, 100),
    exportLeft: clampPosition(((boxRect.left - frameRect.left) / frameRect.width) * 100, 0, 100),
    exportTop: clampPosition(((boxRect.top - frameRect.top) / frameRect.height) * 100, 0, 100),
  };
}

/** Shared horizontal resize mathematics for both poem and custom text boxes. */
export function resizePreviewTextBox(
  side: 'left' | 'right',
  frameRect: PreviewPositioningRect,
  boxRect: Pick<DOMRect, 'left' | 'right'>,
  deltaX: number,
): { positionX: number; boxWidth: number } {
  const startLeft = boxRect.left - frameRect.left;
  const startRight = boxRect.right - frameRect.left;
  const minWidthPx = 60;
  const nextLeft = side === 'left'
    ? clampPosition(startLeft + deltaX, 0, startRight - minWidthPx)
    : startLeft;
  const nextRight = side === 'right'
    ? clampPosition(startRight + deltaX, startLeft + minWidthPx, frameRect.width)
    : startRight;
  return {
    positionX: clampPosition((((nextLeft + nextRight) / 2) / frameRect.width) * 100, 0, 100),
    boxWidth: clampPosition(((nextRight - nextLeft) / frameRect.width) * 100, 5, 100),
  };
}

/**
 * Alt+arrow widths remain zoom-independent only when box and frame widths
 * share the same coordinate space (both visual DOM pixels or both layout px).
 */
export function resizePreviewTextBoxByKeyboard(
  boxWidth: number | undefined,
  measuredBoxWidth: number,
  measuredFrameWidth: number | undefined,
  key: 'ArrowLeft' | 'ArrowRight',
): number {
  const fallback = measuredFrameWidth
    ? clampPosition((measuredBoxWidth / measuredFrameWidth) * 100, 5, 100)
    : 100;
  const current = boxWidth ?? fallback;
  return clampPosition(current + (key === 'ArrowRight' ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP), 5, 100);
}

/**
 * A measured DOM top-left belongs to a specific position and text width.
 * Position or width edits invalidate that anchor unless the caller supplies
 * a *newly measured* exportLeft/exportTop in the same operation.
 */
export function mergePositionUpdate(
  current: PositionedElement,
  updates: Partial<PositionedElement>,
): PositionedElement {
  const geometryChanged = updates.positionX !== undefined
    || updates.positionY !== undefined || 'boxWidth' in updates;
  return {
    ...current,
    ...(geometryChanged ? { exportLeft: undefined, exportTop: undefined } : {}),
    ...updates,
  };
}

/** Convert a percentage center to the pixel center shared by Canvas overlays. */
export function positionToCanvasPoint(frameRect: CanvasPositioningRect, position: RelativePosition): { x: number; y: number } {
  return {
    x: frameRect.x + (frameRect.width * position.positionX) / 100,
    y: frameRect.y + (frameRect.height * position.positionY) / 100,
  };
}

/** Poem top-left can be derived either from the center or a measured DOM box. */
export function getCanvasTextOrigin(
  frameRect: CanvasPositioningRect,
  position: PositionedElement,
  layout: { width: number; height: number },
): { x: number; y: number } {
  const center = positionToCanvasPoint(frameRect, position);
  return {
    x: position.exportLeft !== undefined
      ? frameRect.x + (frameRect.width * position.exportLeft) / 100
      : center.x - layout.width / 2,
    y: position.exportTop !== undefined
      ? frameRect.y + (frameRect.height * position.exportTop) / 100
      : center.y - layout.height / 2,
  };
}
