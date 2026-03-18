import { useEffect, useRef, useState } from 'react';
import type { FC, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { getPreviewDragBounds, getPreviewPositioningRect, type PreviewPositioningRect } from '../../positioningRect';
import type { CustomText } from '../../types';

interface CustomTextItemsProps {
  frameRef: RefObject<HTMLDivElement | null>;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function measureCustomTextGeometry(frameRect: PreviewPositioningRect, boxRect: DOMRect): Pick<CustomText, 'positionX' | 'positionY' | 'exportLeft' | 'exportTop'> {
  return {
    positionX: clamp((((boxRect.left + boxRect.right) / 2 - frameRect.left) / frameRect.width) * 100, 0, 100),
    positionY: clamp((((boxRect.top + boxRect.bottom) / 2 - frameRect.top) / frameRect.height) * 100, 0, 100),
    exportLeft: clamp(((boxRect.left - frameRect.left) / frameRect.width) * 100, 0, 100),
    exportTop: clamp(((boxRect.top - frameRect.top) / frameRect.height) * 100, 0, 100),
  };
}

interface DraggableCustomTextItemProps {
  frameRef: RefObject<HTMLDivElement | null>;
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
  frameRef,
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
              ...measureCustomTextGeometry(frameRect, textRect),
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
    const startLeft = boxRect.left - frameRect.left;
    const startRight = boxRect.right - frameRect.left;
    const pointerId = event.pointerId;
    const minWidthPx = 60;
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
      const textRect = textBoxRef.current?.getBoundingClientRect();
      onCustomTextChange(
        customText.id,
        textRect
          ? {
              ...measureCustomTextGeometry(frameRect, textRect),
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
      const frameRect = frameRef.current?.getBoundingClientRect();
      const positioningRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
      const textRect = textBoxRef.current?.getBoundingClientRect();

      if (!positioningRect || !textRect) {
        onCustomTextChange(customText.id, { boxWidth: undefined });
        return;
      }

      onCustomTextChange(customText.id, {
        ...measureCustomTextGeometry(positioningRect, textRect),
        boxWidth: undefined,
      });
    });
  };

  return (
    <div
      ref={textBoxRef}
      className="absolute pointer-events-none"
      style={{
        left: `${livePosition.positionX}%`,
        top: `${livePosition.positionY}%`,
        transform: 'translate(-50%, -50%)',
        width: liveBoxWidth !== undefined ? `${liveBoxWidth}%` : 'max-content',
        zIndex: (customText.zIndex ?? 0) + 20,
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        className="pointer-events-auto relative cursor-move touch-none select-none"
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
          className="whitespace-pre-wrap wrap-break-word max-w-full"
          style={{
            fontFamily,
            fontSize: `${customText.fontSize}px`,
            color: customText.color,
            writingMode: customText.writingMode,
            lineHeight,
            letterSpacing: `${letterSpacing}px`,
            textShadow: sharedTextShadow,
            rotate: `${customText.rotation}deg`,
          }}
        >
          {customText.text}
        </div>
      </div>
    </div>
  );
}

export function CustomTextItems({
  frameRef,
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
  return (
    <>
      {customTexts.map((customText) => (
        <DraggableCustomTextItem
          key={customText.id}
          frameRef={frameRef}
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
