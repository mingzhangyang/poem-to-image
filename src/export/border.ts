import {
  createVectorBorderStrokes,
  getBorderGradientStops,
  getDoubleBorderMetrics,
  isGradientBorderStyle,
  isVectorBorderStyle,
  isShadowBorderStyle,
  toRgba,
} from '../borderUtils';
import type { BorderStyle } from '../types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawBorder(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  borderStyle: BorderStyle,
  color: string,
  borderWidth: number,
) {
  const safeBorderWidth = Math.max(2, borderWidth);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  if (isVectorBorderStyle(borderStyle)) {
    const strokes = createVectorBorderStrokes(rect.width, rect.height, safeBorderWidth, borderStyle);
    ctx.translate(rect.x, rect.y);
    strokes.forEach((stroke) => {
      ctx.save();
      ctx.globalAlpha = stroke.opacity;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = stroke.lineCap ?? 'round';
      ctx.lineJoin = stroke.lineJoin ?? 'round';
      ctx.setLineDash(stroke.dash ?? []);
      ctx.stroke(new Path2D(stroke.path));
      ctx.restore();
    });
    ctx.restore();
    return;
  }

  if (isShadowBorderStyle(borderStyle)) {
    const lineWidth = Math.max(1.1, safeBorderWidth * 0.3);
    const shadowStrokeInset = lineWidth / 2;
    const thinStrokeWidth = Math.max(1, safeBorderWidth * 0.2);
    const thinStrokeInset = thinStrokeWidth / 2;

    ctx.save();
    ctx.strokeStyle = toRgba(color, 0.22);
    ctx.lineWidth = thinStrokeWidth;
    ctx.strokeRect(
      rect.x + thinStrokeInset,
      rect.y + thinStrokeInset,
      rect.width - thinStrokeInset * 2,
      rect.height - thinStrokeInset * 2,
    );
    ctx.restore();

    // Match CSS getBorderShadowCss: blur max(16, bw*4.6), offsetY max(8, bw*1.7)
    ctx.shadowColor = toRgba(color, 0.35);
    ctx.shadowBlur = Math.max(16, safeBorderWidth * 4.6);
    ctx.shadowOffsetY = Math.max(8, safeBorderWidth * 1.7);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = toRgba(color, 0.58);
    ctx.strokeRect(
      rect.x + shadowStrokeInset,
      rect.y + shadowStrokeInset,
      rect.width - shadowStrokeInset * 2,
      rect.height - shadowStrokeInset * 2,
    );
    ctx.restore();
    return;
  }

  if (isGradientBorderStyle(borderStyle)) {
    // Match CSS linear-gradient(132deg): angle measured clockwise from top
    const angleRad = (132 * Math.PI) / 180;
    const dx = Math.sin(angleRad);
    const dy = -Math.cos(angleRad);
    const halfLen = (rect.width * Math.abs(dx) + rect.height * Math.abs(dy)) / 2;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const gradient = ctx.createLinearGradient(
      cx - dx * halfLen,
      cy - dy * halfLen,
      cx + dx * halfLen,
      cy + dy * halfLen,
    );
    const [startColor, midColor, endColor] = getBorderGradientStops(color);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(0.48, midColor);
    gradient.addColorStop(1, endColor);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = safeBorderWidth;
    ctx.strokeRect(
      rect.x + safeBorderWidth / 2,
      rect.y + safeBorderWidth / 2,
      rect.width - safeBorderWidth,
      rect.height - safeBorderWidth,
    );
    ctx.restore();
    return;
  }

  if (borderStyle === 'dashed') {
    ctx.lineWidth = safeBorderWidth;
    ctx.setLineDash([safeBorderWidth * 4, safeBorderWidth * 3]);
    ctx.strokeRect(
      rect.x + safeBorderWidth / 2,
      rect.y + safeBorderWidth / 2,
      rect.width - safeBorderWidth,
      rect.height - safeBorderWidth,
    );
    ctx.restore();
    return;
  }

  if (borderStyle === 'double') {
    const { lineWidth: doubleLineWidth, innerInset } = getDoubleBorderMetrics(safeBorderWidth);
    ctx.lineWidth = doubleLineWidth;
    ctx.strokeRect(
      rect.x + doubleLineWidth / 2,
      rect.y + doubleLineWidth / 2,
      rect.width - doubleLineWidth,
      rect.height - doubleLineWidth,
    );
    ctx.strokeRect(
      rect.x + innerInset,
      rect.y + innerInset,
      rect.width - innerInset * 2,
      rect.height - innerInset * 2,
    );
    ctx.restore();
    return;
  }

  ctx.lineWidth = safeBorderWidth;
  ctx.strokeRect(
    rect.x + safeBorderWidth / 2,
    rect.y + safeBorderWidth / 2,
    rect.width - safeBorderWidth,
    rect.height - safeBorderWidth,
  );
  ctx.restore();
}
