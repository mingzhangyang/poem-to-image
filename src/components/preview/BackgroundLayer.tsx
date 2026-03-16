import type { CSSProperties } from 'react';
import type { BackgroundType } from '../../types';

interface BackgroundLayerProps {
  backgroundType: BackgroundType;
  backgroundStyle: CSSProperties;
  bgBrightness: number;
  bgBlur: number;
}

export function BackgroundLayer({ backgroundType, backgroundStyle, bgBrightness, bgBlur }: BackgroundLayerProps) {
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
    </>
  );
}