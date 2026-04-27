import type { CanvasExportScene } from './renderCanvasExport';

const IMAGE_CACHE_LIMIT = 32;
const imageLoadCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string) {
  const cached = imageLoadCache.get(src);
  if (cached) return cached;

  const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => {
      imageLoadCache.delete(src);
      reject(new Error('Failed to load image'));
    };
    image.src = src;
  });

  imageLoadCache.set(src, loadPromise);
  if (imageLoadCache.size > IMAGE_CACHE_LIMIT) {
    const oldestKey = imageLoadCache.keys().next().value;
    if (oldestKey) imageLoadCache.delete(oldestKey);
  }

  return loadPromise;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createGradient(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  direction: string,
  color1: string,
  color2: string,
) {
  let x0 = rect.x;
  let y0 = rect.y;
  let x1 = rect.x + rect.width;
  let y1 = rect.y;

  if (direction === 'to bottom') {
    x1 = rect.x;
    y1 = rect.y + rect.height;
  } else if (direction === 'to bottom right') {
    x1 = rect.x + rect.width;
    y1 = rect.y + rect.height;
  } else if (direction === 'to top right') {
    x0 = rect.x;
    y0 = rect.y + rect.height;
    x1 = rect.x + rect.width;
    y1 = rect.y;
  }

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

export async function drawBackground(ctx: CanvasRenderingContext2D, scene: CanvasExportScene) {
  const { canvasWidth, canvasHeight, background } = scene;
  const rect = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

  if (background.backgroundType === 'transparent') {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    return;
  }

  if (background.backgroundType === 'solid') {
    ctx.fillStyle = background.backgroundColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (background.backgroundType === 'gradient') {
    ctx.fillStyle = createGradient(
      ctx,
      rect,
      background.gradientDirection,
      background.gradientColor1,
      background.gradientColor2,
    );
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (!background.backgroundImage) return;

  const image = await loadImage(background.backgroundImage);
  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;

  if (background.backgroundSize === 'stretch') {
    drawWidth = canvasWidth;
    drawHeight = canvasHeight;
  } else if (background.backgroundSize === 'contain') {
    if (imageRatio > canvasRatio) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imageRatio;
    } else {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imageRatio;
    }
  } else {
    // Default cover
    if (imageRatio > canvasRatio) {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imageRatio;
    } else {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imageRatio;
    }
  }

  if (background.bgBlur > 0) {
    drawWidth *= 1.1;
    drawHeight *= 1.1;
  }

  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  ctx.save();
  ctx.filter = `brightness(${background.bgBrightness}%) blur(${background.bgBlur}px)`;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
