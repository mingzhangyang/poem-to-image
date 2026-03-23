import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import {
  createVectorBorderStrokes,
  getBorderGradientCss,
  getBorderPadding,
  getBorderShadowCss,
  isGradientBorderStyle,
  isInsetBorderStyle,
  isShadowBorderStyle,
  isVectorBorderStyle,
} from '../../borderUtils';
import { useElementSize } from '../../hooks/useElementSize';
import { createStructuredPoemLayout } from '../../poemContent';
import { getPreviewDragBounds, getPreviewPositioningRect, type PreviewPositioningRect } from '../../positioningRect';
import type { BorderStyle, CustomText, LogoConfig, PoemContentData, PoemLayerStyle, PositionedElement, StampConfig, TextAlign, TranslateFn, WritingMode } from '../../types';
import { CustomTextItems } from './CustomTextItems';
import { LogoOverlay } from './LogoOverlay';
import { StampOverlay } from './StampOverlay';
import { TextLayoutBlock } from './TextLayoutBlock';

interface PoemContentProps {
  poemFrameRef: RefObject<HTMLDivElement | null>;
  poemTextRef: RefObject<HTMLDivElement | null>;
  t: TranslateFn;
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
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
  customTexts: CustomText[];
  logos: LogoConfig[];
  poemPosition: PositionedElement;
  onPoemPositionChange: (updates: Partial<PositionedElement>) => void;
  onStampChange: (updates: Partial<StampConfig>) => void;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onLogoChange: (id: string, updates: Partial<LogoConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function measurePositionedElement(frameRect: PreviewPositioningRect, boxRect: DOMRect): PositionedElement {
  return {
    positionX: clamp((((boxRect.left + boxRect.right) / 2 - frameRect.left) / frameRect.width) * 100, 0, 100),
    positionY: clamp((((boxRect.top + boxRect.bottom) / 2 - frameRect.top) / frameRect.height) * 100, 0, 100),
    exportLeft: clamp(((boxRect.left - frameRect.left) / frameRect.width) * 100, 0, 100),
    exportTop: clamp(((boxRect.top - frameRect.top) / frameRect.height) * 100, 0, 100),
  };
}

export function PoemContent({
  poemFrameRef,
  poemTextRef,
  t,
  poem,
  poemStyle,
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
  customTexts,
  logos,
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  onCustomTextChange,
  onLogoChange,
  onInteractionStart,
  onInteractionEnd,
}: PoemContentProps) {
  const poemBoxRef = useRef<HTMLDivElement>(null);
  const previousCustomTextIdsRef = useRef<string[]>(customTexts.map((customText) => customText.id));
  const [livePosition, setLivePosition] = useState(poemPosition);
  const [activeTextSelection, setActiveTextSelection] = useState<{ kind: 'poem' } | { kind: 'customText'; id: string } | null>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [liveBoxWidth, setLiveBoxWidth] = useState<number | undefined>(poemPosition.boxWidth);
  const safeBorderWidth = Number.isFinite(borderWidth) ? Math.max(2, borderWidth) : 4;
  const insetBorder = isInsetBorderStyle(borderStyle);
  const vectorBorder = isVectorBorderStyle(borderStyle);
  const shadowBorder = isShadowBorderStyle(borderStyle);
  const gradientBorder = isGradientBorderStyle(borderStyle);
  const borderPadding = showBorder ? `${getBorderPadding(safeBorderWidth, borderStyle)}px` : '0';
  const frameSize = useElementSize(poemFrameRef);
  const borderRenderWidth = Math.max(1, frameSize.width || 100);
  const borderRenderHeight = Math.max(1, frameSize.height || 100);
  const borderStrokes = useMemo(
    () => showBorder && vectorBorder
      ? createVectorBorderStrokes(borderRenderWidth, borderRenderHeight, safeBorderWidth, borderStyle)
      : [],
    [showBorder, vectorBorder, borderRenderWidth, borderRenderHeight, safeBorderWidth, borderStyle],
  );
  const poemLayout = createStructuredPoemLayout(
    {
      poem,
      poemStyle,
      placeholder: t('poemPlaceholder'),
      writingMode,
      fontFamily,
      fontSize,
      lineHeight,
      letterSpacing,
      textAlign,
      columns: columnCount,
      columnGap,
      wrapWidth: writingMode === 'horizontal-tb'
        ? Math.max(1, liveBoxWidth !== undefined ? (frameSize.width * liveBoxWidth) / 100 : frameSize.width || 1)
        : liveBoxWidth !== undefined
          ? Math.max(1, (frameSize.width * liveBoxWidth) / 100)
          : undefined,
    },
  );

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition(poemPosition);
    }
    if (!isResizingRef.current) {
      setLiveBoxWidth(poemPosition.boxWidth);
    }
  }, [poemPosition]);

  useEffect(() => {
    if (activeTextSelection?.kind === 'customText' && !customTexts.some((customText) => customText.id === activeTextSelection.id)) {
      setActiveTextSelection(null);
    }
  }, [activeTextSelection, customTexts]);

  useEffect(() => {
    const previousIds = previousCustomTextIdsRef.current;
    const nextIds = customTexts.map((customText) => customText.id);
    const addedId = nextIds.find((id) => !previousIds.includes(id));

    if (addedId) {
      setActiveTextSelection({ kind: 'customText', id: addedId });
    }

    previousCustomTextIdsRef.current = nextIds;
  }, [customTexts]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = poemFrameRef.current ? getPreviewPositioningRect(poemFrameRef.current) : null;
    const boxRect = poemBoxRef.current?.getBoundingClientRect();

    if (!frameRect || !boxRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setActiveTextSelection({ kind: 'poem' });
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
    const bounds = getPreviewDragBounds(frameRect, boxRect);

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
              ...measurePositionedElement(frameRect, poemRect),
              boxWidth: liveBoxWidth,
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
        positionX: clamp(
          startPosition.positionX + ((moveEvent.clientX - startX) / frameRect.width) * 100,
          bounds.minPositionX,
          bounds.maxPositionX,
        ),
        positionY: clamp(
          startPosition.positionY + ((moveEvent.clientY - startY) / frameRect.height) * 100,
          bounds.minPositionY,
          bounds.maxPositionY,
        ),
      };

      livePositionRef.current = nextPosition;
      setLivePosition(nextPosition);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleResizePointerDown = (side: 'left' | 'right', event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = poemFrameRef.current ? getPreviewPositioningRect(poemFrameRef.current) : null;
    const boxRect = poemBoxRef.current?.getBoundingClientRect();

    if (!frameRect || !boxRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setActiveTextSelection({ kind: 'poem' });

    const startX = event.clientX;
    const startLeft = boxRect.left - frameRect.left;
    const startRight = boxRect.right - frameRect.left;
    const pointerId = event.pointerId;
    isResizingRef.current = true;
    setIsResizing(true);
    onInteractionStart();

    const liveStateRef = {
      current: {
        positionX: livePosition.positionX,
        positionY: livePosition.positionY,
        boxWidth: liveBoxWidth,
      },
    };
    const minWidthPx = 60;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const delta = moveEvent.clientX - startX;
      const nextLeft = side === 'left'
        ? clamp(startLeft + delta, 0, startRight - minWidthPx)
        : startLeft;
      const nextRight = side === 'right'
        ? clamp(startRight + delta, startLeft + minWidthPx, frameRect.width)
        : startRight;
      const nextWidthPx = nextRight - nextLeft;
      const nextBoxWidth = clamp((nextWidthPx / frameRect.width) * 100, 5, 100);
      const nextPositionX = clamp((((nextLeft + nextRight) / 2) / frameRect.width) * 100, 0, 100);

      liveStateRef.current = {
        positionX: nextPositionX,
        positionY: livePosition.positionY,
        boxWidth: nextBoxWidth,
      };
      setLivePosition((current) => ({ ...current, positionX: nextPositionX }));
      setLiveBoxWidth(nextBoxWidth);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      isResizingRef.current = false;
      setIsResizing(false);
      const poemRect = poemBoxRef.current?.getBoundingClientRect();
      onPoemPositionChange(
        poemRect
          ? {
              ...measurePositionedElement(frameRect, poemRect),
              boxWidth: liveStateRef.current.boxWidth,
            }
          : liveStateRef.current,
      );
      onInteractionEnd();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleResizeDoubleClick = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveTextSelection({ kind: 'poem' });
    setLiveBoxWidth(undefined);
    window.requestAnimationFrame(() => {
      const frameRect = poemFrameRef.current?.getBoundingClientRect();
      const positioningRect = poemFrameRef.current ? getPreviewPositioningRect(poemFrameRef.current) : null;
      const poemRect = poemBoxRef.current?.getBoundingClientRect();

      if (!positioningRect || !poemRect) {
        onPoemPositionChange({ boxWidth: undefined });
        return;
      }

      onPoemPositionChange({
        ...measurePositionedElement(positioningRect, poemRect),
        boxWidth: undefined,
      });
    });
  };

  return (
    <div
      ref={poemFrameRef}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          setActiveTextSelection(null);
        }
      }}
      className="relative z-10 flex h-full w-full flex-col items-center justify-center"
      style={{
        boxSizing: 'border-box',
        borderColor: showBorder && insetBorder && !gradientBorder ? borderColor : 'transparent',
        borderStyle: showBorder && insetBorder ? (gradientBorder ? 'solid' : borderStyle) : 'none',
        borderWidth: showBorder && insetBorder ? `${safeBorderWidth}px` : '0',
        borderImage: showBorder && gradientBorder ? `${getBorderGradientCss(borderColor)} 1` : 'none',
        boxShadow: showBorder && shadowBorder ? getBorderShadowCss(borderColor, safeBorderWidth) : 'none',
        padding: borderPadding,
      }}
    >
      {showBorder && vectorBorder ? (
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${borderRenderWidth} ${borderRenderHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {borderStrokes.map((stroke, index) => (
            <path
              key={index}
              d={stroke.path}
              fill="none"
              stroke={borderColor}
              strokeWidth={stroke.width}
              strokeLinecap={stroke.lineCap ?? 'round'}
              strokeLinejoin={stroke.lineJoin ?? 'round'}
              strokeDasharray={stroke.dash?.join(' ')}
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
          width: `${poemLayout.width}px`,
          height: `${poemLayout.height}px`,
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          className="pointer-events-auto relative flex cursor-move touch-none select-none flex-col items-center justify-center"
        >
          {/* Hover/drag/resize border indicator — absolutely positioned, no effect on text layout */}
          {(activeTextSelection?.kind === 'poem' || isDragging || isResizing) && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                top: '-8px',
                left: '-8px',
                right: '-8px',
                bottom: '-8px',
                border: (isDragging || isResizing)
                  ? '1.5px solid rgba(255,255,255,0.95)'
                  : '1.5px dashed rgba(255,255,255,0.75)',
                borderRadius: '3px',
                boxShadow: (isDragging || isResizing)
                  ? '0 0 0 1.5px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.25)'
                  : '0 0 0 1.5px rgba(0,0,0,0.4)',
                transition: 'border 0.12s ease, box-shadow 0.12s ease',
              }}
            >
              {/* Left resize handle */}
              <div
                className="pointer-events-auto absolute"
                style={{
                  left: '-5px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '10px',
                  height: '28px',
                  cursor: 'ew-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPointerDown={(e) => handleResizePointerDown('left', e)}
                onDoubleClick={handleResizeDoubleClick}
              >
                <div
                  style={{
                    width: '4px',
                    height: '20px',
                    borderRadius: '2px',
                    background: 'rgba(255,255,255,0.9)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                  }}
                />
              </div>
              {/* Right resize handle */}
              <div
                className="pointer-events-auto absolute"
                style={{
                  right: '-5px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '10px',
                  height: '28px',
                  cursor: 'ew-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPointerDown={(e) => handleResizePointerDown('right', e)}
                onDoubleClick={handleResizeDoubleClick}
              >
                <div
                  style={{
                    width: '4px',
                    height: '20px',
                    borderRadius: '2px',
                    background: 'rgba(255,255,255,0.9)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                  }}
                />
              </div>
            </div>
          )}
          <div
            ref={poemTextRef}
            className="max-w-full"
          >
            <div
              className="relative"
              style={{
                width: `${poemLayout.width}px`,
                height: `${poemLayout.height}px`,
              }}
            >
              {poemLayout.sections.map((section) => (
                <div
                  key={section.key}
                  className="absolute left-0 top-0"
                  style={{
                    left: `${section.x}px`,
                    top: `${section.y}px`,
                    opacity: section.opacity,
                  }}
                >
                  <TextLayoutBlock
                    layout={section.layout}
                    fontFamily={fontFamily}
                    fontSize={section.fontSize}
                    color={textColor}
                    letterSpacing={section.letterSpacing}
                    lineHeight={section.lineHeight}
                    textShadow={sharedTextShadow}
                  />
                </div>
              ))}
            </div>
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

      <CustomTextItems
        frameRef={poemFrameRef}
        frameWidth={frameSize.width}
        customTexts={customTexts}
        activeCustomTextId={activeTextSelection?.kind === 'customText' ? activeTextSelection.id : null}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        letterSpacing={letterSpacing}
        sharedTextShadow={sharedTextShadow}
        onCustomTextSelect={(id) => setActiveTextSelection(id ? { kind: 'customText', id } : null)}
        onCustomTextChange={onCustomTextChange}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />

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
