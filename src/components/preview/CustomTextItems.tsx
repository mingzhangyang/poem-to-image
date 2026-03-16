import { motion } from 'motion/react';
import type { CustomText, TranslateFn } from '../../types';

interface CustomTextItemsProps {
  customTexts: CustomText[];
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  sharedTextShadow: string;
}

export function CustomTextItems({
  customTexts,
  fontFamily,
  lineHeight,
  letterSpacing,
  sharedTextShadow,
}: CustomTextItemsProps) {
  return (
    <>
      {customTexts.map((customText) => (
        <motion.div
          key={customText.id}
          drag
          dragMomentum={false}
          className="absolute cursor-move whitespace-pre-wrap wrap-break-word"
          style={{
            fontFamily,
            fontSize: `${customText.fontSize}px`,
            color: customText.color,
            writingMode: customText.writingMode,
            lineHeight,
            letterSpacing: `${letterSpacing}px`,
            textShadow: sharedTextShadow,
            zIndex: 50,
            rotate: customText.rotation,
          }}
        >
          {customText.text}
        </motion.div>
      ))}
    </>
  );
}