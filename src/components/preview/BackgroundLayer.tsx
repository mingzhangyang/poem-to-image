import { useEffect, useState, type CSSProperties } from 'react';
import type { BackgroundType } from '../../types';

interface BackgroundLayerProps {
  backgroundType: BackgroundType;
  backgroundImage: string | null;
  backgroundStyle: CSSProperties;
  bgBrightness: number;
  bgBlur: number;
  loadingLabel: string;
}

export function BackgroundLayer({
  backgroundType,
  backgroundImage,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  loadingLabel,
}: BackgroundLayerProps) {
  const [settledImage, setSettledImage] = useState<string | null>(null);
  const hasImage = (backgroundType === 'image' || backgroundType === 'ai') && Boolean(backgroundImage);
  const isLoading = hasImage && settledImage !== backgroundImage;

  useEffect(() => {
    if (!hasImage || !backgroundImage) {
      return;
    }

    let isCurrent = true;
    const image = new Image();
    const markSettled = () => {
      if (isCurrent) {
        setSettledImage(backgroundImage);
      }
    };

    image.addEventListener('load', markSettled, { once: true });
    image.addEventListener('error', markSettled, { once: true });
    image.src = backgroundImage;

    return () => {
      isCurrent = false;
      image.removeEventListener('load', markSettled);
      image.removeEventListener('error', markSettled);
    };
  }, [backgroundImage, hasImage]);

  return (
    <>
      <div
        data-export-layer="background"
        className="absolute inset-0 z-0"
        style={{
          ...backgroundStyle,
          filter: `brightness(${bgBrightness}%) blur(${bgBlur}px)`,
          transform: bgBlur > 0 ? 'scale(1.1)' : 'none',
        }}
      />

      {backgroundType === 'image' || backgroundType === 'ai' ? (
        <div data-export-layer="background" className="absolute inset-0 bg-black/10 pointer-events-none z-0" />
      ) : null}

      {isLoading ? (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/55 backdrop-blur-sm"
          role="status"
          aria-label={loadingLabel}
          data-testid="background-loading"
        >
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-(--app-accent-200) border-t-(--app-accent-700)" />
        </div>
      ) : null}
    </>
  );
}
