import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { createOrganicBorderStrokes, getBorderPadding } from '../../borderUtils';
import type { BorderStyle, LogoConfig, PositionedElement, StampConfig, TextAlign, TranslateFn, WritingMode } from '../../types';
import { LogoOverlay } from './LogoOverlay';
import { StampOverlay } from './StampOverlay';

interface PoemContentProps {
  poemFrameRef: RefObject<HTMLDivElement | null>;
  poemTextRef: RefObject<HTMLDivElement | null>;
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
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  stamp: StampConfig;
  logos: LogoConfig[];
  poemPosition: PositionedElement;
  onPoemPositionChange: (updates: Partial<PositionedElement>) => void;
  onStampChange: (updates: Partial<StampConfig>) => void;
  onLogoChange: (id: string, updates: Partial<LogoConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PoemContent({
  poemFrameRef,
  poemTextRef,
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
  borderColor,
  borderWidth,
  showStamp,
  stamp,
  logos,
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  onLogoChange,
  onInteractionStart,
  onInteractionEnd,
}: PoemContentProps) {
  const poemBoxRef = useRef<HTMLDivElement>(null);
  const [livePosition, setLivePosition] = useState(poemPosition);
  const isDraggingRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const safeBorderWidth = Number.isFinite(borderWidth) ? Math.max(2, borderWidth) : 4;
  const borderPadding = showBorder ? `${getBorderPadding(safeBorderWidth, borderStyle)}px` : '0';
  const organicBorderStrokes = showBorder && (borderStyle === 'brush' || borderStyle === 'ink')
    ? createOrganicBorderStrokes(100, 100, safeBorderWidth, borderStyle)
    : [];

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition(poemPosition);
    }
  }, [poemPosition]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = poemFrameRef.current?.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
    const pointerId = event.pointerId;
    onInteractionStart();

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      isDraggingRef.current = false;
      setIsDragging(false);
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
      ref={poemFrameRef}
      className="relative z-10 flex h-full w-full flex-col items-center justify-center"
      style={{
        borderColor,
        borderStyle: showBorder && borderStyle !== 'brush' && borderStyle !== 'ink' ? borderStyle : 'none',
        borderWidth: showBorder && borderStyle !== 'brush' && borderStyle !== 'ink' ? `${safeBorderWidth}px` : '0',
        padding: borderPadding,
      }}
    >
      {showBorder && (borderStyle === 'brush' || borderStyle === 'ink') ? (
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {organicBorderStrokes.map((stroke, index) => (
            <path
              key={`${stroke.path}-${index}`}
              d={stroke.path}
              fill="none"
              stroke={borderColor}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={stroke.opacity}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      ) : null}

      <div
        ref={poemBoxRef}
        className="absolute z-10 pointer-events-none"
        style={{
          left: `${livePosition.positionX}%`,
          top: `${livePosition.positionY}%`,
          transform: 'translate(-50%, -50%)',
          maxWidth: '100%',
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          className="pointer-events-auto relative flex cursor-move touch-none select-none flex-col items-center justify-center"
        >
          {/* Hover/drag border indicator — absolutely positioned, no effect on text layout */}
          {(isHovered || isDragging) && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                top: '-8px',
                left: '-8px',
                right: '-8px',
                bottom: '-8px',
                border: isDragging
                  ? '1.5px solid rgba(255,255,255,0.95)'
                  : '1.5px dashed rgba(255,255,255,0.75)',
                borderRadius: '3px',
                boxShadow: isDragging
                  ? '0 0 0 1.5px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.25)'
                  : '0 0 0 1.5px rgba(0,0,0,0.4)',
                transition: 'border 0.12s ease, box-shadow 0.12s ease',
              }}
            />
          )}
          <div
            ref={poemTextRef}
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
          frameRef={poemFrameRef}
          stamp={stamp}
          onStampChange={onStampChange}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      ) : null}

      {logos.map((logo) => (
        <LogoOverlay
          key={logo.id}
          frameRef={poemFrameRef}
          logo={logo}
          onLogoChange={(updates) => onLogoChange(logo.id, updates)}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      ))}
    </div>
  );
}