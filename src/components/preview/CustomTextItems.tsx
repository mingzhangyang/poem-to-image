import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FC,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { useFontLayoutRevision } from '../../hooks/useFontLayoutRevision';
import {
  getKeyboardDragBounds, getPreviewDragBounds, getPreviewPositioningRect,
  isArrowDirection, measurePreviewElement, movePreviewPosition,
  nudgePreviewPosition, resizePreviewTextBox, resizePreviewTextBoxByKeyboard,
} from '../../positioningRect';
import { createCanvasTextMeasurer, createTextLayout } from '../../textLayout';
import type { CustomText } from '../../types';
import { TextLayoutBlock } from './TextLayoutBlock';

interface CustomTextItemsProps {
  ariaLabel: string;
  frameRef: RefObject<HTMLDivElement | null>;
  frameWidth: number;
  customTexts: CustomText[];
  activeCustomTextId: string | null;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  sharedTextShadow: string;
  onCustomTextSelect: (id: string | null) => void;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

interface DraggableCustomTextItemProps {
  ariaLabel: string;
  frameRef: RefObject<HTMLDivElement | null>;
  frameWidth: number;
  customText: CustomText;
  isSelected: boolean;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  sharedTextShadow: string;
  onCustomTextSelect: (id: string | null) => void;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

const DraggableCustomTextItem: FC<DraggableCustomTextItemProps> = ({
  ariaLabel,
  frameRef,
  frameWidth,
  customText,
  isSelected,
  fontFamily,
  lineHeight,
  letterSpacing,
  sharedTextShadow,
  onCustomTextSelect,
  onCustomTextChange,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const textBoxRef = useRef<HTMLDivElement>(null);
  const [livePosition, setLivePosition] = useState({ positionX: customText.positionX, positionY: customText.positionY });
  const [liveBoxWidth, setLiveBoxWidth] = useState<number | undefined>(customText.boxWidth);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const fontRevision = useFontLayoutRevision(fontFamily, customText.text);
  const textLayout = useMemo(() => createTextLayout(
    {
      text: customText.text || ' ',
      writingMode: customText.writingMode,
      fontSize: customText.fontSize,
      lineHeight,
      letterSpacing,
      columns: 1,
      columnGap: 0,
      textAlign: 'left',
      wrapWidth: liveBoxWidth !== undefined
        ? Math.max(1, (frameWidth * liveBoxWidth) / 100)
        : undefined,
    },
    createCanvasTextMeasurer(fontFamily, customText.fontSize),
  ), [
    customText.text, customText.writingMode, customText.fontSize,
    lineHeight, letterSpacing, liveBoxWidth, frameWidth, fontFamily, fontRevision,
  ]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: customText.positionX, positionY: customText.positionY });
    }
  }, [customText.positionX, customText.positionY]);

  useEffect(() => {
    if (!isResizingRef.current) {
      setLiveBoxWidth(customText.boxWidth);
    }
  }, [customText.boxWidth]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = textBoxRef.current?.getBoundingClientRect();

    if (!frameRect || !boxRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onCustomTextSelect(customText.id);
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    const livePositionRef = { current: startPosition };
    isDraggingRef.current = true;
    setIsDragging(true);
    const bounds = getPreviewDragBounds(frameRect, boxRect);
    const pointerId = event.pointerId;
    onInteractionStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const nextPosition = movePreviewPosition(startPosition, {
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      }, frameRect, bounds);

      livePositionRef.current = nextPosition;
      setLivePosition(nextPosition);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      isDraggingRef.current = false;
      setIsDragging(false);
      const textRect = textBoxRef.current?.getBoundingClientRect();
      onCustomTextChange(
        customText.id,
        textRect
          ? {
              ...measurePreviewElement(frameRect, textRect),
              boxWidth: liveBoxWidth,
            }
          : livePositionRef.current,
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

  const handleResizePointerDown = (side: 'left' | 'right', event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = textBoxRef.current?.getBoundingClientRect();

    if (!frameRect || !boxRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onCustomTextSelect(customText.id);

    const startX = event.clientX;
    const pointerId = event.pointerId;
    const liveStateRef = {
      current: {
        positionX: livePosition.positionX,
        positionY: livePosition.positionY,
        boxWidth: liveBoxWidth,
      },
    };

    isResizingRef.current = true;
    setIsResizing(true);
    onInteractionStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const { positionX: nextPositionX, boxWidth: nextBoxWidth } =
        resizePreviewTextBox(side, frameRect, boxRect, moveEvent.clientX - startX);

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
      const textRect = textBoxRef.current?.getBoundingClientRect();
      onCustomTextChange(
        customText.id,
        textRect
          ? {
              ...measurePreviewElement(frameRect, textRect),
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
    onCustomTextSelect(customText.id);
    setLiveBoxWidth(undefined);

    window.requestAnimationFrame(() => {
      const positioningRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
      const textRect = textBoxRef.current?.getBoundingClientRect();

      if (!positioningRect || !textRect) {
        onCustomTextChange(customText.id, { boxWidth: undefined });
        return;
      }

      onCustomTextChange(customText.id, {
        ...measurePreviewElement(positioningRect, textRect),
        boxWidth: undefined,
      });
    });
  };

  const handleKeyboardMove = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (!isArrowDirection(key)) return;
    event.preventDefault();
    event.stopPropagation();
    onCustomTextSelect(customText.id);

    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = textBoxRef.current?.getBoundingClientRect();
    const bounds = getKeyboardDragBounds(frameRect, boxRect);

    if (event.altKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      const nextWidth = resizePreviewTextBoxByKeyboard(liveBoxWidth, textLayout.width, frameRect?.width, key);
      setLiveBoxWidth(nextWidth);
      onCustomTextChange(customText.id, { ...livePosition, boxWidth: nextWidth });
      return;
    }

    const nextPosition = nudgePreviewPosition(livePosition, key, event.shiftKey, bounds);

    setLivePosition(nextPosition);
    onCustomTextChange(customText.id, { ...nextPosition, boxWidth: liveBoxWidth });
  };

  return (
    <div
      ref={textBoxRef}
      className="absolute pointer-events-none"
      style={{
        left: `${livePosition.positionX}%`,
        top: `${livePosition.positionY}%`,
        transform: 'translate(-50%, -50%)',
        width: `${textLayout.width}px`,
        height: `${textLayout.height}px`,
        zIndex: (customText.zIndex ?? 0) + 20,
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyboardMove}
        onFocus={() => onCustomTextSelect(customText.id)}
        tabIndex={0}
        aria-label={ariaLabel}
        className="pointer-events-auto relative cursor-move touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(20, 169, 155,0.45)]"
      >
        {(isSelected || isDragging || isResizing) ? (
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
              onPointerDown={(resizeEvent) => handleResizePointerDown('left', resizeEvent)}
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
              onPointerDown={(resizeEvent) => handleResizePointerDown('right', resizeEvent)}
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
        ) : null}

        <div
          className="max-w-full"
          style={{
            rotate: `${customText.rotation}deg`,
          }}
        >
          <TextLayoutBlock
            layout={textLayout}
            fontFamily={fontFamily}
            fontSize={customText.fontSize}
            color={customText.color}
            letterSpacing={letterSpacing}
            lineHeight={lineHeight}
            textShadow={sharedTextShadow}
          />
        </div>
      </div>
    </div>
  );
}

export function CustomTextItems({
  ariaLabel,
  frameRef,
  frameWidth,
  customTexts,
  activeCustomTextId,
  fontFamily,
  lineHeight,
  letterSpacing,
  sharedTextShadow,
  onCustomTextSelect,
  onCustomTextChange,
  onInteractionStart,
  onInteractionEnd,
}: CustomTextItemsProps) {
  const measuredFrameSize = useElementSize(frameRef);
  const effectiveFrameWidth = frameWidth || measuredFrameSize.width;

  return (
    <>
      {customTexts.map((customText) => (
        <DraggableCustomTextItem
          ariaLabel={ariaLabel}
          key={customText.id}
          frameRef={frameRef}
          frameWidth={effectiveFrameWidth}
          customText={customText}
          isSelected={activeCustomTextId === customText.id}
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          sharedTextShadow={sharedTextShadow}
          onCustomTextSelect={onCustomTextSelect}
          onCustomTextChange={onCustomTextChange}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      ))}
    </>
  );
}
