import { RotateCcw, ZoomIn } from 'lucide-react';
import { motion } from 'motion/react';
import type { CanvasPreviewProps } from '../types';
import { BackgroundLayer } from './preview/BackgroundLayer';
import { CustomTextItems } from './preview/CustomTextItems';
import { PoemContent } from './preview/PoemContent';
import { TransparentGrid } from './preview/TransparentGrid';

export function CanvasPreview({
  containerRef,
  previewRef,
  t,
  text,
  backgroundType,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  fontFamily,
  fontSize,
  textColor,
  textAlign,
  writingMode,
  padding,
  lineHeight,
  letterSpacing,
  columns,
  columnGap,
  textShadowEnabled,
  textShadowColor,
  textShadowBlur,
  textShadowOffsetY,
  textShadowOffsetX,
  showBorder,
  borderStyle,
  showStamp,
  stamp,
  onStampChange,
  canvasWidth,
  canvasHeight,
  customTexts,
  previewZoom,
  onPreviewZoomChange,
  onPreviewZoomReset,
  scale,
}: CanvasPreviewProps) {
  const sharedTextShadow = textShadowEnabled
    ? `${textShadowOffsetX}px ${textShadowOffsetY}px ${textShadowBlur}px ${textShadowColor}`
    : 'none';
  const effectiveScale = scale * previewZoom;
  const previewScalePercent = Math.round(effectiveScale * 100);

  return (
    <section
      ref={containerRef}
      className="order-1 flex items-center justify-center bg-gray-200/50 overflow-hidden relative h-dvh min-h-105 p-4 pt-6 pb-24 sm:p-6 md:order-2 md:flex-1 md:h-screen md:min-h-screen md:max-h-screen md:px-8 md:pb-8 md:pt-24"
    >
      <TransparentGrid visible={backgroundType === 'transparent'} />

      <div className="hidden md:flex absolute right-6 top-6 z-20 items-center gap-3 rounded-2xl border border-white/75 bg-white/92 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ZoomIn className="h-4 w-4 text-gray-500" />
          <span>{t('previewZoom')}</span>
          <span className="min-w-12 text-right font-semibold text-gray-950">{previewScalePercent}%</span>
        </div>

        <input
          type="range"
          min="60"
          max="100"
          step="1"
          value={Math.round(previewZoom * 100)}
          onChange={(event) => onPreviewZoomChange(Number(event.target.value) / 100)}
          className="h-2 w-36 cursor-pointer accent-gray-950"
          aria-label={t('previewZoom')}
        />

        <button
          type="button"
          onClick={onPreviewZoomReset}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{t('fitToViewport')}</span>
        </button>
      </div>

      <div style={{ transform: `scale(${effectiveScale})`, transformOrigin: 'center', transition: 'transform 0.2s ease-out' }}>
        <div
          className="relative shadow-2xl flex items-center justify-center overflow-hidden"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
          }}
        >
          <div
            ref={previewRef}
            className="w-full h-full flex items-center justify-center relative overflow-hidden"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              padding: `${padding}px`,
            }}
          >
            <BackgroundLayer
              backgroundType={backgroundType}
              backgroundStyle={backgroundStyle}
              bgBrightness={bgBrightness}
              bgBlur={bgBlur}
            />

            <CustomTextItems
              customTexts={customTexts}
              fontFamily={fontFamily}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
              sharedTextShadow={sharedTextShadow}
            />

            <PoemContent
              t={t}
              text={text}
              fontFamily={fontFamily}
              fontSize={fontSize}
              textColor={textColor}
              textAlign={textAlign}
              writingMode={writingMode}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
              columnCount={columns}
              columnGap={columnGap}
              sharedTextShadow={sharedTextShadow}
              showBorder={showBorder}
              borderStyle={borderStyle}
              showStamp={showStamp}
              stamp={stamp}
              onStampChange={onStampChange}
            />
          </div>
        </div>
      </div>
    </section>
  );
}