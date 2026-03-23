import type { VectorBorderStyle, BorderStroke, DoubleBorderMetrics } from './types';
import { normalizeBorderWidth, getInsetBounds, toRectPath } from './utils';
import { isOrganicBorderStyle, createOrganicBorderStrokes } from './organic';

export function getDoubleBorderMetrics(borderWidth: number): DoubleBorderMetrics {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const lineWidth = Math.max(1.25, safeBorderWidth * 0.32);
  const gap = Math.max(1.5, safeBorderWidth * 0.36);
  const innerInset = lineWidth + gap;

  return {
    lineWidth,
    innerInset,
    maxPaintInset: innerInset + lineWidth / 2,
  };
}

function createBrokenBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const { left, top, right, bottom } = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const frameWidth = right - left;
  const frameHeight = bottom - top;
  const cornerGap = Math.min(Math.max(9, safeBorderWidth * 2.2), Math.min(frameWidth, frameHeight) * 0.22);
  const majorGap = Math.min(Math.max(30, safeBorderWidth * 5.2), frameWidth * 0.36);
  const minorGap = Math.min(Math.max(14, safeBorderWidth * 3.1), frameHeight * 0.34);
  const primaryPath = [
    `M ${(left + cornerGap).toFixed(2)} ${top.toFixed(2)} L ${(right - majorGap).toFixed(2)} ${top.toFixed(2)}`,
    `M ${right.toFixed(2)} ${(top + cornerGap).toFixed(2)} L ${right.toFixed(2)} ${(bottom - minorGap).toFixed(2)}`,
    `M ${(right - cornerGap).toFixed(2)} ${bottom.toFixed(2)} L ${(left + majorGap * 0.7).toFixed(2)} ${bottom.toFixed(2)}`,
    `M ${left.toFixed(2)} ${(bottom - cornerGap).toFixed(2)} L ${left.toFixed(2)} ${(top + majorGap * 0.42).toFixed(2)}`,
  ].join(' ');
  const secondaryInset = safeBorderWidth * 1.12;
  const secondary = getInsetBounds(width, height, safeBorderWidth / 2 + secondaryInset);
  const secondaryWidth = secondary.right - secondary.left;
  const secondaryPath = [
    `M ${(secondary.left + secondaryWidth * 0.18).toFixed(2)} ${secondary.top.toFixed(2)} L ${(secondary.left + secondaryWidth * 0.54).toFixed(2)} ${secondary.top.toFixed(2)}`,
    `M ${(secondary.right - secondaryWidth * 0.2).toFixed(2)} ${secondary.bottom.toFixed(2)} L ${(secondary.right - secondaryWidth * 0.45).toFixed(2)} ${secondary.bottom.toFixed(2)}`,
  ].join(' ');

  return [
    {
      path: primaryPath,
      opacity: 0.92,
      width: Math.max(1.4, safeBorderWidth * 0.92),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: secondaryPath,
      opacity: 0.42,
      width: Math.max(1.05, safeBorderWidth * 0.52),
      dash: [Math.max(4, safeBorderWidth * 1.7), Math.max(6, safeBorderWidth * 2.3)],
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

function createOverflowBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const { left, top, right, bottom } = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const frameWidth = right - left;
  const frameHeight = bottom - top;
  const shortestEdge = Math.max(1, Math.min(frameWidth, frameHeight));
  const mainPath = toRectPath(left, top, right, bottom);
  const arm = Math.min(Math.max(15, safeBorderWidth * 3.6), shortestEdge * 0.52);
  const edgeOffset = Math.min(Math.max(20, safeBorderWidth * 5), shortestEdge * 0.42);
  const burstPath = [
    `M ${(left + edgeOffset).toFixed(2)} ${top.toFixed(2)} L ${(left - arm * 0.72).toFixed(2)} ${(top - arm * 0.42).toFixed(2)}`,
    `M ${left.toFixed(2)} ${(top + edgeOffset).toFixed(2)} L ${(left - arm * 0.42).toFixed(2)} ${(top - arm * 0.72).toFixed(2)}`,
    `M ${(right - edgeOffset).toFixed(2)} ${top.toFixed(2)} L ${(right + arm * 0.72).toFixed(2)} ${(top - arm * 0.42).toFixed(2)}`,
    `M ${right.toFixed(2)} ${(top + edgeOffset).toFixed(2)} L ${(right + arm * 0.42).toFixed(2)} ${(top - arm * 0.72).toFixed(2)}`,
    `M ${(right - edgeOffset).toFixed(2)} ${bottom.toFixed(2)} L ${(right + arm * 0.72).toFixed(2)} ${(bottom + arm * 0.42).toFixed(2)}`,
    `M ${right.toFixed(2)} ${(bottom - edgeOffset).toFixed(2)} L ${(right + arm * 0.42).toFixed(2)} ${(bottom + arm * 0.72).toFixed(2)}`,
    `M ${(left + edgeOffset).toFixed(2)} ${bottom.toFixed(2)} L ${(left - arm * 0.72).toFixed(2)} ${(bottom + arm * 0.42).toFixed(2)}`,
    `M ${left.toFixed(2)} ${(bottom - edgeOffset).toFixed(2)} L ${(left - arm * 0.42).toFixed(2)} ${(bottom + arm * 0.72).toFixed(2)}`,
  ].join(' ');
  const inner = getInsetBounds(width, height, safeBorderWidth / 2 + Math.max(2.5, safeBorderWidth * 1.25));
  const innerPath = toRectPath(inner.left, inner.top, inner.right, inner.bottom);

  return [
    {
      path: mainPath,
      opacity: 0.9,
      width: Math.max(1.25, safeBorderWidth * 0.88),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: innerPath,
      opacity: 0.28,
      width: Math.max(0.9, safeBorderWidth * 0.44),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: burstPath,
      opacity: 0.72,
      width: Math.max(1, safeBorderWidth * 0.52),
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

function createOrnamentalBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const outer = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const inner = getInsetBounds(width, height, safeBorderWidth / 2 + Math.max(3.2, safeBorderWidth * 1.72));
  const shortestEdge = Math.max(1, Math.min(outer.right - outer.left, outer.bottom - outer.top));
  const curl = Math.min(Math.max(12, safeBorderWidth * 3), shortestEdge * 0.24);
  const feather = Math.min(Math.max(7, safeBorderWidth * 1.8), shortestEdge * 0.16);
  const { left, top, right, bottom } = outer;
  const cornerCurls = [
    `M ${(left + curl).toFixed(2)} ${top.toFixed(2)} C ${(left + feather).toFixed(2)} ${top.toFixed(2)} ${left.toFixed(2)} ${(top + feather).toFixed(2)} ${left.toFixed(2)} ${(top + curl).toFixed(2)}`,
    `M ${(right - curl).toFixed(2)} ${top.toFixed(2)} C ${(right - feather).toFixed(2)} ${top.toFixed(2)} ${right.toFixed(2)} ${(top + feather).toFixed(2)} ${right.toFixed(2)} ${(top + curl).toFixed(2)}`,
    `M ${(right - curl).toFixed(2)} ${bottom.toFixed(2)} C ${(right - feather).toFixed(2)} ${bottom.toFixed(2)} ${right.toFixed(2)} ${(bottom - feather).toFixed(2)} ${right.toFixed(2)} ${(bottom - curl).toFixed(2)}`,
    `M ${(left + curl).toFixed(2)} ${bottom.toFixed(2)} C ${(left + feather).toFixed(2)} ${bottom.toFixed(2)} ${left.toFixed(2)} ${(bottom - feather).toFixed(2)} ${left.toFixed(2)} ${(bottom - curl).toFixed(2)}`,
    `M ${(left + curl * 0.78).toFixed(2)} ${(top + feather * 0.38).toFixed(2)} Q ${(left + curl * 0.28).toFixed(2)} ${(top + curl * 0.2).toFixed(2)} ${(left + feather * 0.42).toFixed(2)} ${(top + curl * 0.78).toFixed(2)}`,
    `M ${(right - curl * 0.78).toFixed(2)} ${(top + feather * 0.38).toFixed(2)} Q ${(right - curl * 0.28).toFixed(2)} ${(top + curl * 0.2).toFixed(2)} ${(right - feather * 0.42).toFixed(2)} ${(top + curl * 0.78).toFixed(2)}`,
    `M ${(right - curl * 0.78).toFixed(2)} ${(bottom - feather * 0.38).toFixed(2)} Q ${(right - curl * 0.28).toFixed(2)} ${(bottom - curl * 0.2).toFixed(2)} ${(right - feather * 0.42).toFixed(2)} ${(bottom - curl * 0.78).toFixed(2)}`,
    `M ${(left + curl * 0.78).toFixed(2)} ${(bottom - feather * 0.38).toFixed(2)} Q ${(left + curl * 0.28).toFixed(2)} ${(bottom - curl * 0.2).toFixed(2)} ${(left + feather * 0.42).toFixed(2)} ${(bottom - curl * 0.78).toFixed(2)}`,
  ].join(' ');

  return [
    {
      path: toRectPath(outer.left, outer.top, outer.right, outer.bottom),
      opacity: 0.84,
      width: Math.max(1.15, safeBorderWidth * 0.56),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: toRectPath(inner.left, inner.top, inner.right, inner.bottom),
      opacity: 0.42,
      width: Math.max(1, safeBorderWidth * 0.32),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: cornerCurls,
      opacity: 0.8,
      width: Math.max(1, safeBorderWidth * 0.5),
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

function createEnvelopeBorderStrokes(width: number, height: number, borderWidth: number): BorderStroke[] {
  const safeBorderWidth = normalizeBorderWidth(borderWidth);
  const outer = getInsetBounds(width, height, safeBorderWidth / 2 + 1);
  const frameWidth = outer.right - outer.left;
  const frameHeight = outer.bottom - outer.top;
  const shortestEdge = Math.max(1, Math.min(frameWidth, frameHeight));
  const centerX = (outer.left + outer.right) / 2;
  const flapHalf = Math.min(Math.max(14, safeBorderWidth * 3.5), frameWidth * 0.22);
  const flapDepth = Math.min(Math.max(12, safeBorderWidth * 3), frameHeight * 0.22);
  const fold = Math.min(Math.max(10, safeBorderWidth * 2.6), shortestEdge * 0.24);
  const inner = getInsetBounds(width, height, safeBorderWidth / 2 + Math.max(3, safeBorderWidth * 1.4));
  const lowerJoinY = Math.min(outer.bottom - fold * 0.7, outer.top + frameHeight * 0.56);
  const seamY = Math.min(
    outer.bottom - Math.max(10, safeBorderWidth * 2),
    outer.top + flapDepth + Math.max(8, safeBorderWidth * 2),
  );
  const seamHalf = Math.min(frameWidth * 0.28, Math.max(24, safeBorderWidth * 6));
  const envelopeFramePath = [
    `M ${outer.left.toFixed(2)} ${outer.top.toFixed(2)} L ${(centerX - flapHalf).toFixed(2)} ${outer.top.toFixed(2)}`,
    `M ${(centerX + flapHalf).toFixed(2)} ${outer.top.toFixed(2)} L ${outer.right.toFixed(2)} ${outer.top.toFixed(2)}`,
    `M ${outer.right.toFixed(2)} ${outer.top.toFixed(2)} L ${outer.right.toFixed(2)} ${outer.bottom.toFixed(2)} L ${outer.left.toFixed(2)} ${outer.bottom.toFixed(2)} L ${outer.left.toFixed(2)} ${outer.top.toFixed(2)}`,
  ].join(' ');
  const foldPath = [
    `M ${(centerX - flapHalf).toFixed(2)} ${outer.top.toFixed(2)} L ${centerX.toFixed(2)} ${(outer.top + flapDepth).toFixed(2)} L ${(centerX + flapHalf).toFixed(2)} ${outer.top.toFixed(2)}`,
    `M ${outer.left.toFixed(2)} ${outer.top.toFixed(2)} L ${(outer.left + fold).toFixed(2)} ${(outer.top + fold).toFixed(2)}`,
    `M ${outer.right.toFixed(2)} ${outer.top.toFixed(2)} L ${(outer.right - fold).toFixed(2)} ${(outer.top + fold).toFixed(2)}`,
    `M ${outer.left.toFixed(2)} ${outer.bottom.toFixed(2)} L ${(outer.left + fold).toFixed(2)} ${(outer.bottom - fold).toFixed(2)}`,
    `M ${outer.right.toFixed(2)} ${outer.bottom.toFixed(2)} L ${(outer.right - fold).toFixed(2)} ${(outer.bottom - fold).toFixed(2)}`,
    `M ${outer.left.toFixed(2)} ${outer.bottom.toFixed(2)} L ${centerX.toFixed(2)} ${lowerJoinY.toFixed(2)} L ${outer.right.toFixed(2)} ${outer.bottom.toFixed(2)}`,
  ].join(' ');
  const seamPath = `M ${(centerX - seamHalf).toFixed(2)} ${seamY.toFixed(2)} L ${(centerX + seamHalf).toFixed(2)} ${seamY.toFixed(2)}`;

  return [
    {
      path: envelopeFramePath,
      opacity: 0.9,
      width: Math.max(1.25, safeBorderWidth * 0.86),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: toRectPath(inner.left, inner.top, inner.right, inner.bottom),
      opacity: 0.32,
      width: Math.max(0.95, safeBorderWidth * 0.4),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: foldPath,
      opacity: 0.78,
      width: Math.max(1, safeBorderWidth * 0.48),
      lineCap: 'round',
      lineJoin: 'round',
    },
    {
      path: seamPath,
      opacity: 0.5,
      width: Math.max(0.85, safeBorderWidth * 0.34),
      dash: [Math.max(4, safeBorderWidth * 1.5), Math.max(4, safeBorderWidth * 1.8)],
      lineCap: 'round',
      lineJoin: 'round',
    },
  ];
}

export function createVectorBorderStrokes(
  width: number,
  height: number,
  borderWidth: number,
  borderStyle: VectorBorderStyle,
): BorderStroke[] {
  if (isOrganicBorderStyle(borderStyle)) {
    return createOrganicBorderStrokes(width, height, borderWidth, borderStyle).map((stroke) => ({
      path: stroke.path,
      opacity: stroke.opacity,
      width: stroke.width,
      lineCap: 'round',
      lineJoin: 'round',
    }));
  }

  if (borderStyle === 'broken') {
    return createBrokenBorderStrokes(width, height, borderWidth);
  }

  if (borderStyle === 'overflow') {
    return createOverflowBorderStrokes(width, height, borderWidth);
  }

  if (borderStyle === 'ornamental') {
    return createOrnamentalBorderStrokes(width, height, borderWidth);
  }

  if (borderStyle === 'envelope') {
    return createEnvelopeBorderStrokes(width, height, borderWidth);
  }

  return [];
}
