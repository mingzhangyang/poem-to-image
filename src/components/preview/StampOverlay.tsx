import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { getPreviewDragBounds, getPreviewPositioningRect } from '../../positioningRect';
import {
  getBrushStampSkew,
  getStampCssBorderRadius,
} from '../../stampRendering';
import { renderStampBodyToContext } from '../../export/renderCanvasExport';
import type { StampConfig } from '../../types';

interface StampOverlayProps {
  frameRef: RefObject<HTMLDivElement | null>;
  stamp: StampConfig;
  onStampChange: (updates: Partial<StampConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFrameStyle(stamp: StampConfig): CSSProperties {
  const { skewXDeg, skewYDeg } = getBrushStampSkew();
  const borderRadius = getStampCssBorderRadius(stamp.style, stamp.size);
  const transform = `rotate(${stamp.rotation}deg)${stamp.style === 'brush' ? ` skew(${skewXDeg}deg, ${skewYDeg}deg)` : ''}`;
  const isFilled = stamp.colorScheme !== 'outline';
  const inkColor = stamp.inkColor ?? '#c82829';
  const boxShadow = isFilled
    ? `0 8px 20px ${inkColor}38, 0 2px 6px ${inkColor}24`
    : `0 8px 20px ${inkColor}1f, 0 2px 6px ${inkColor}14`;

  return {
    width: `${stamp.size}px`,
    height: `${stamp.size}px`,
    opacity: stamp.opacity,
    borderRadius,
    overflow: 'hidden',
    boxShadow,
    transform,
  };
}

export function StampOverlay({ frameRef, stamp, onStampChange, onInteractionStart, onInteractionEnd }: StampOverlayProps) {
  const [livePosition, setLivePosition] = useState({ positionX: stamp.positionX, positionY: stamp.positionY });
  const isDraggingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = stamp.size;
    canvas.height = stamp.size;
    ctx.clearRect(0, 0, stamp.size, stamp.size);
    ctx.save();
    ctx.translate(stamp.size / 2, stamp.size / 2);
    renderStampBodyToContext(ctx, stamp);
    ctx.restore();
  }, [stamp]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: stamp.positionX, positionY: stamp.positionY });
    }
  }, [stamp.positionX, stamp.positionY]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = event.currentTarget.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    const livePositionRef = { current: startPosition };
    const pointerId = event.pointerId;
    isDraggingRef.current = true;
    const bounds = getPreviewDragBounds(frameRect, boxRect);
    onInteractionStart();

    const finishInteraction = () => {
      isDraggingRef.current = false;
      onStampChange(livePositionRef.current);
      onInteractionEnd();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

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

      finishInteraction();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${livePosition.positionX}%`,
        top: `${livePosition.positionY}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        className="pointer-events-auto relative cursor-move touch-none select-none"
        style={{
          ...getFrameStyle(stamp),
        }}
      >
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0"
          width={stamp.size}
          height={stamp.size}
        />
      </div>
    </div>
  );
}
