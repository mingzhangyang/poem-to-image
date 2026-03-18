import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject, FC } from 'react';
import { getPreviewDragBounds, getPreviewPositioningRect } from '../../positioningRect';
import type { LogoConfig } from '../../types';

interface LogoOverlayProps {
  frameRef: RefObject<HTMLDivElement | null>;
  logo: LogoConfig;
  onLogoChange: (updates: Partial<LogoConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const LogoOverlay: FC<LogoOverlayProps> = ({ frameRef, logo, onLogoChange, onInteractionStart, onInteractionEnd }) => {
  const [livePosition, setLivePosition] = useState({ positionX: logo.positionX, positionY: logo.positionY });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: logo.positionX, positionY: logo.positionY });
    }
  }, [logo.positionX, logo.positionY]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = event.currentTarget.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onInteractionStart();
    isDraggingRef.current = true;
    const bounds = getPreviewDragBounds(frameRect, boxRect);
    const pointerId = event.pointerId;

    const startX = event.clientX;
    const startY = event.clientY;
    const startPositionX = livePosition.positionX;
    const startPositionY = livePosition.positionY;
    const livePositionRef = { current: { positionX: startPositionX, positionY: startPositionY } };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newPositionX = clamp(
        startPositionX + (deltaX / frameRect.width) * 100,
        bounds.minPositionX,
        bounds.maxPositionX,
      );
      const newPositionY = clamp(
        startPositionY + (deltaY / frameRect.height) * 100,
        bounds.minPositionY,
        bounds.maxPositionY,
      );

      livePositionRef.current = { positionX: newPositionX, positionY: newPositionY };
      setLivePosition(livePositionRef.current);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      onLogoChange(livePositionRef.current);
      isDraggingRef.current = false;
      onInteractionEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: `${livePosition.positionX}%`,
    top: `${livePosition.positionY}%`,
    transform: 'translate(-50%, -50%)',
    width: `${logo.size}px`,
    height: `${logo.size}px`,
    opacity: logo.opacity,
    transformOrigin: 'center',
    rotate: `${logo.rotation}deg`,
    cursor: 'grab',
    userSelect: 'none',
    zIndex: (logo.zIndex ?? 0) + 20,
  };

  return (
    <div
      style={style}
      onPointerDown={handlePointerDown}
      className="absolute touch-none select-none"
    >
      <img
        src={logo.imageUrl}
        alt="Logo"
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}
