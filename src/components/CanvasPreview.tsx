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
  stampText,
  canvasWidth,
  canvasHeight,
  customTexts,
  scale,
}: CanvasPreviewProps) {
  const sharedTextShadow = textShadowEnabled
    ? `${textShadowOffsetX}px ${textShadowOffsetY}px ${textShadowBlur}px ${textShadowColor}`
    : 'none';

  return (
    <section
      ref={containerRef}
      className="order-1 flex items-center justify-center bg-gray-200/50 overflow-hidden relative h-[100dvh] min-h-[420px] p-4 pt-6 pb-24 sm:p-6 md:order-2 md:flex-1 md:h-auto md:min-h-[100dvh] md:max-h-none md:p-8"
    >
      <TransparentGrid visible={backgroundType === 'transparent'} />

      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.2s ease-out' }}>
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
              stampText={stampText}
            />
          </div>
        </div>
      </div>
    </section>
  );
}