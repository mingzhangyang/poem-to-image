import { isOrganicBorderStyle } from './borderUtils';
import type { BorderStyle } from './types';

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

function parseBorderWidth(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPreviewPositioningRect(element: HTMLElement): PreviewPositioningRect {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  const borderLeft = parseBorderWidth(computedStyle.borderLeftWidth);
  const borderTop = parseBorderWidth(computedStyle.borderTopWidth);
  const borderRight = parseBorderWidth(computedStyle.borderRightWidth);
  const borderBottom = parseBorderWidth(computedStyle.borderBottomWidth);

  return {
    left: rect.left + borderLeft,
    top: rect.top + borderTop,
    width: Math.max(1, rect.width - borderLeft - borderRight),
    height: Math.max(1, rect.height - borderTop - borderBottom),
  };
}

export function getCanvasPositioningRect(
  contentRect: CanvasPositioningRect,
  showBorder: boolean,
  borderStyle: BorderStyle,
  borderWidth: number,
): CanvasPositioningRect {
  const safeBorderWidth = Number.isFinite(borderWidth) ? Math.max(2, borderWidth) : 4;
  const inset = showBorder && !isOrganicBorderStyle(borderStyle) ? safeBorderWidth : 0;

  return {
    x: contentRect.x + inset,
    y: contentRect.y + inset,
    width: Math.max(1, contentRect.width - inset * 2),
    height: Math.max(1, contentRect.height - inset * 2),
  };
}

export function getPreviewDragBounds(frameRect: PreviewPositioningRect, boxRect: DOMRect): DragBounds {
  const halfWidthPercent = Math.min(50, Math.max(0, (boxRect.width / 2 / frameRect.width) * 100));
  const halfHeightPercent = Math.min(50, Math.max(0, (boxRect.height / 2 / frameRect.height) * 100));

  return {
    minPositionX: halfWidthPercent,
    maxPositionX: 100 - halfWidthPercent,
    minPositionY: halfHeightPercent,
    maxPositionY: 100 - halfHeightPercent,
  };
}
