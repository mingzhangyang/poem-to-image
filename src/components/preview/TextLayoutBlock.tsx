import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import type { TextLayoutResult } from '../../textLayout';

interface TextLayoutBlockProps {
  layout: TextLayoutResult;
  fontFamily: string;
  fontSize: number;
  color: string;
  letterSpacing: number;
  lineHeight: number;
  textShadow: string;
}

export const TextLayoutBlock = forwardRef<HTMLDivElement, TextLayoutBlockProps>(function TextLayoutBlock(
  { layout, fontFamily, fontSize, color, letterSpacing, lineHeight, textShadow },
  ref,
) {
  const sharedTextStyle: CSSProperties = {
    fontFamily,
    fontSize: `${fontSize}px`,
    color,
    letterSpacing: `${letterSpacing}px`,
    lineHeight,
    textShadow,
    whiteSpace: 'pre',
  };

  return (
    <div
      ref={ref}
      className="relative"
      style={{
        width: `${layout.width}px`,
        height: `${layout.height}px`,
      }}
    >
      {layout.writingMode === 'vertical-rl' ? (
        <svg
          data-vertical-text-layout="true"
          width={layout.width}
          height={layout.height}
          className="absolute left-0 top-0 overflow-visible"
          style={{ overflow: 'visible' }}
          role="img"
          aria-label={layout.items.map((item) => item.text).join('')}
        >
          {layout.items.map((item, index) => item.kind === 'vertical-segment' ? (
            <text
              key={`vertical-glyph-${index}`}
              data-original-char={item.text}
              x={item.startX}
              y={item.baselineY}
              transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
              style={{
                fontFamily,
                fontSize: `${fontSize}px`,
                fill: color,
                letterSpacing: `${letterSpacing}px`,
                textShadow,
                whiteSpace: 'pre',
              }}
            >{item.renderText}</text>
          ) : null)}
        </svg>
      ) : layout.items.map((item, index) => item.kind === 'horizontal-line' ? (
        <span
          key={`text-line-${index}`}
          className="absolute left-0 top-0"
          style={{
            ...sharedTextStyle,
            left: `${item.x}px`,
            top: `${item.y}px`,
          }}
        >
          {item.text}
        </span>
      ) : null)}
    </div>
  );
});
