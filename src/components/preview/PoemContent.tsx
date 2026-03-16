import { useRef } from 'react';
import { motion } from 'motion/react';
import type { BorderStyle, StampConfig, TextAlign, TranslateFn, WritingMode } from '../../types';
import { StampOverlay } from './StampOverlay';

interface PoemContentProps {
  t: TranslateFn;
  text: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: TextAlign;
  writingMode: WritingMode;
  lineHeight: number;
  letterSpacing: number;
  columnCount: number;
  columnGap: number;
  sharedTextShadow: string;
  showBorder: boolean;
  borderStyle: BorderStyle;
  showStamp: boolean;
  stamp: StampConfig;
  onStampChange: (updates: Partial<StampConfig>) => void;
}

export function PoemContent({
  t,
  text,
  fontFamily,
  fontSize,
  textColor,
  textAlign,
  writingMode,
  lineHeight,
  letterSpacing,
  columnCount,
  columnGap,
  sharedTextShadow,
  showBorder,
  borderStyle,
  showStamp,
  stamp,
  onStampChange,
}: PoemContentProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={frameRef}
      className={`relative z-10 flex flex-col items-center justify-center w-full h-full ${showBorder ? 'border-4' : ''}`}
      style={{
        borderColor: textColor,
        borderStyle: showBorder ? borderStyle : 'none',
        padding: showBorder ? '2rem' : '0',
      }}
    >
      <motion.div drag dragMomentum={false} className="flex flex-col items-center justify-center cursor-move">
        <div
          className="whitespace-pre-wrap wrap-break-word max-w-full"
          style={{
            fontFamily,
            fontSize: `${fontSize}px`,
            color: textColor,
            textAlign,
            writingMode,
            lineHeight,
            letterSpacing: `${letterSpacing}px`,
            textShadow: sharedTextShadow,
            columnCount,
            columnGap: `${columnGap}px`,
          }}
        >
          {text || t('poemPlaceholder')}
        </div>
      </motion.div>

      {showStamp ? <StampOverlay frameRef={frameRef} stamp={stamp} onStampChange={onStampChange} /> : null}
    </div>
  );
}