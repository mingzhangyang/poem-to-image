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
      {layout.items.map((item, index) => {
        if (item.kind === 'horizontal-line') {
          return (
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
          );
        }

        return (
          <span
            key={`text-segment-${index}`}
            className="absolute left-0 top-0"
            style={{
              ...sharedTextStyle,
              left: `${item.x}px`,
              top: `${item.y}px`,
              transform: item.sideways
                ? 'translate(-50%, -50%) rotate(90deg)'
                : 'translate(-50%, -50%)',
              transformOrigin: 'center',
              lineHeight: 1,
            }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
});
