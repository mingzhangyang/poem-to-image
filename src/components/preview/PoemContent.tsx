import { motion } from 'motion/react';
import type { BorderStyle, TextAlign, TranslateFn, WritingMode } from '../../types';

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
  stampText: string;
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
  stampText,
}: PoemContentProps) {
  return (
    <div
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

        {showStamp ? (
          <div
            className="mt-8 border-2 rounded-sm flex items-center justify-center font-bold"
            style={{
              borderColor: '#dc2626',
              color: '#dc2626',
              width: `${fontSize * 1.5}px`,
              height: `${fontSize * 1.5}px`,
              fontSize: `${fontSize * 0.8}px`,
              fontFamily: '"Ma Shan Zheng", cursive',
              writingMode: 'horizontal-tb',
              opacity: 0.8,
              transform: 'rotate(-5deg)',
              alignSelf: writingMode === 'vertical-rl' ? 'flex-end' : 'auto',
            }}
          >
            {stampText}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}