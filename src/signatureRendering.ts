import type { SignatureConfig } from './types';

export const SIGNATURE_FONTS = [
  { value: 'Great Vibes', label: 'Elegant' },
  { value: 'Mr Dafoe', label: 'Classic' },
  { value: 'Caveat', label: 'Marker' },
  { value: 'Dancing Script', label: 'Lively' },
  { value: 'Pacifico', label: 'Retro' },
  { value: 'Satisfy', label: 'Brush' },
  { value: 'Alex Brush', label: 'Calligraphy' },
  { value: 'Parisienne', label: 'Parisian' },
  { value: 'Sacramento', label: 'Delicate' },
  { value: 'Yellowtail', label: 'Bold Script' },
  { value: 'Homemade Apple', label: 'Cursive' },
  { value: 'Allura', label: 'Stylized' },
];

export const DEFAULT_SIGNATURE_FONT = SIGNATURE_FONTS[0].value;
const SIGNATURE_FONT_STYLESHEET_HREF = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Mr+Dafoe&family=Caveat&family=Dancing+Script&family=Pacifico&family=Satisfy&family=Alex+Brush&family=Parisienne&family=Sacramento&family=Yellowtail&family=Homemade+Apple&family=Allura&display=swap';
let signatureFontsReadyPromise: Promise<void> | null = null;

function waitForSignatureFonts(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    const handleLoad = () => {
      link.dataset.loaded = 'true';
      finish();
    };

    link.addEventListener('load', handleLoad, { once: true });
    link.addEventListener('error', finish, { once: true });

    // Fallback for browsers that do not reliably fire load for cached stylesheets.
    window.setTimeout(finish, 1800);
  });
}

export async function ensureSignatureFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  if (!signatureFontsReadyPromise) {
    signatureFontsReadyPromise = (async () => {
      let link = document.head.querySelector<HTMLLinkElement>('link[data-signature-fonts="true"]');

      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = SIGNATURE_FONT_STYLESHEET_HREF;
        link.setAttribute('data-signature-fonts', 'true');
        document.head.appendChild(link);
      }

      if (link.dataset.loaded !== 'true') {
        await waitForSignatureFonts(link);
      }

      if ('fonts' in document) {
        await Promise.allSettled(
          SIGNATURE_FONTS.map((font) => document.fonts.load(`16px "${font.value}"`)),
        );
      }
    })();
  }

  await signatureFontsReadyPromise;
}

// Canvas area relative to fontSize so the signature has room
const WIDTH_FACTOR = 9;
const HEIGHT_FACTOR = 2.8;

export function getSignatureCanvasSize(fontSize: number) {
  return {
    width: Math.ceil(fontSize * WIDTH_FACTOR),
    height: Math.ceil(fontSize * HEIGHT_FACTOR),
  };
}

type SigDrawParams = Pick<SignatureConfig, 'text' | 'font' | 'color' | 'fontSize' | 'slant' | 'thickness' | 'flourish'>;

/**
 * Draws the signature onto the given context.
 * Caller is responsible for clearing the canvas beforehand if needed.
 */
export function drawSignatureToCanvas(
  ctx: CanvasRenderingContext2D,
  sig: SigDrawParams,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (!sig.text) return;

  ctx.font = `${sig.fontSize}px "${sig.font}", cursive`;
  ctx.fillStyle = sig.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((sig.slant * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);

  ctx.fillText(sig.text, centerX, centerY);

  if (sig.thickness > 0) {
    ctx.lineWidth = sig.thickness;
    ctx.strokeStyle = sig.color;
    ctx.strokeText(sig.text, centerX, centerY);
  }

  if (sig.flourish !== 'none') {
    const metrics = ctx.measureText(sig.text);
    const textWidth = metrics.width;
    const startX = centerX - textWidth / 2;
    const endX = centerX + textWidth / 2;
    const startY = centerY + sig.fontSize / 2.5;

    ctx.beginPath();
    ctx.strokeStyle = sig.color;
    ctx.lineWidth = Math.max(2, sig.fontSize / 25) + sig.thickness / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (sig.flourish === 'swoosh') {
      ctx.moveTo(startX - 10, startY);
      ctx.bezierCurveTo(
        startX + textWidth / 3, startY + 15,
        endX - textWidth / 3, startY - 5,
        endX + 20, startY + 5,
      );
    } else if (sig.flourish === 'double') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, startY);
      ctx.moveTo(startX + 10, startY + 8);
      ctx.lineTo(endX - 10, startY + 8);
    } else if (sig.flourish === 'loop') {
      ctx.moveTo(startX - 10, startY);
      ctx.bezierCurveTo(
        startX + textWidth / 2, startY + 20,
        endX + 20, startY + 20,
        endX - 10, startY + 5,
      );
      ctx.bezierCurveTo(
        endX - 30, startY - 10,
        startX + 20, startY + 10,
        endX + 30, startY + 15,
      );
    } else if (sig.flourish === 'strike') {
      ctx.moveTo(startX - 15, centerY);
      ctx.lineTo(endX + 15, centerY);
    } else if (sig.flourish === 'wave') {
      ctx.moveTo(startX, startY);
      const waveWidth = endX - startX;
      for (let i = 0; i <= waveWidth; i += 2) {
        ctx.lineTo(startX + i, startY + Math.sin(i * 0.1) * 4);
      }
    } else if (sig.flourish === 'underline') {
      ctx.moveTo(startX - 5, startY);
      ctx.lineTo(endX + 5, startY);
    }

    ctx.stroke();
  }

  ctx.restore();
}
