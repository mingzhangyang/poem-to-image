import { useEffect, useRef, useState } from 'react';
import type { BorderStyle, PositionedElement, StampConfig, TextAlign, TranslateFn, WritingMode } from '../../types';
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
  poemPosition: PositionedElement;
  onPoemPositionChange: (updates: Partial<PositionedElement>) => void;
  onStampChange: (updates: Partial<StampConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  onInteractionStart,
  onInteractionEnd,
}: PoemContentProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const poemBoxRef = useRef<HTMLDivElement>(null);
  const [livePosition, setLivePosition] = useState(poemPosition);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition(poemPosition);
    }
  }, [poemPosition]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current?.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    isDraggingRef.current = true;
    const pointerId = event.pointerId;
    onInteractionStart();

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      isDraggingRef.current = false;
      const poemRect = poemBoxRef.current?.getBoundingClientRect();
      onPoemPositionChange(
        poemRect
          ? {
              ...livePositionRef.current,
              exportLeft: clamp(((poemRect.left - frameRect.left) / frameRect.width) * 100, 0, 100),
              exportTop: clamp(((poemRect.top - frameRect.top) / frameRect.height) * 100, 0, 100),
            }
          : livePositionRef.current,
      );
      onInteractionEnd();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    const livePositionRef = { current: startPosition };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const nextPosition = {
        positionX: clamp(startPosition.positionX + ((moveEvent.clientX - startX) / frameRect.width) * 100, 8, 92),
        positionY: clamp(startPosition.positionY + ((moveEvent.clientY - startY) / frameRect.height) * 100, 8, 92),
      };

      livePositionRef.current = nextPosition;
      setLivePosition(nextPosition);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

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
      <div
        ref={poemBoxRef}
        className="absolute pointer-events-none"
        style={{
          left: `${livePosition.positionX}%`,
          top: `${livePosition.positionY}%`,
          transform: 'translate(-50%, -50%)',
          maxWidth: '100%',
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          className="pointer-events-auto flex cursor-move flex-col items-center justify-center"
        >
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
        </div>
      </div>

      {showStamp ? (
        <StampOverlay
          frameRef={frameRef}
          stamp={stamp}
          onStampChange={onStampChange}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      ) : null}
    </div>
  );
}