import { useEffect, useRef, useState } from 'react';
import type { FC, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { CustomText } from '../../types';

interface CustomTextItemsProps {
  frameRef: RefObject<HTMLDivElement | null>;
  customTexts: CustomText[];
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  sharedTextShadow: string;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface DraggableCustomTextItemProps {
  frameRef: RefObject<HTMLDivElement | null>;
  customText: CustomText;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  sharedTextShadow: string;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

const DraggableCustomTextItem: FC<DraggableCustomTextItemProps> = ({
  frameRef,
  customText,
  fontFamily,
  lineHeight,
  letterSpacing,
  sharedTextShadow,
  onCustomTextChange,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const textBoxRef = useRef<HTMLDivElement>(null);
  const [livePosition, setLivePosition] = useState({ positionX: customText.positionX, positionY: customText.positionY });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: customText.positionX, positionY: customText.positionY });
    }
  }, [customText.positionX, customText.positionY]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current?.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    const livePositionRef = { current: startPosition };
    isDraggingRef.current = true;
    const pointerId = event.pointerId;
    onInteractionStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const nextPosition = {
        positionX: clamp(startPosition.positionX + ((moveEvent.clientX - startX) / frameRect.width) * 100, 4, 96),
        positionY: clamp(startPosition.positionY + ((moveEvent.clientY - startY) / frameRect.height) * 100, 4, 96),
      };

      livePositionRef.current = nextPosition;
      setLivePosition(nextPosition);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      isDraggingRef.current = false;
      const textRect = textBoxRef.current?.getBoundingClientRect();
      onCustomTextChange(
        customText.id,
        textRect
          ? {
              ...livePositionRef.current,
              exportLeft: clamp(((textRect.left - frameRect.left) / frameRect.width) * 100, 0, 100),
              exportTop: clamp(((textRect.top - frameRect.top) / frameRect.height) * 100, 0, 100),
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

  return (
    <div
      ref={textBoxRef}
      className="absolute pointer-events-none"
      style={{
        left: `${livePosition.positionX}%`,
        top: `${livePosition.positionY}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: (customText.zIndex ?? 0) + 20,
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        className="pointer-events-auto cursor-move touch-none select-none whitespace-pre-wrap wrap-break-word"
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
  );
}

export function CustomTextItems({
  frameRef,
  customTexts,
  fontFamily,
  lineHeight,
  letterSpacing,
  sharedTextShadow,
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
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          sharedTextShadow={sharedTextShadow}
          onCustomTextChange={onCustomTextChange}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      ))}
    </>
  );
}
