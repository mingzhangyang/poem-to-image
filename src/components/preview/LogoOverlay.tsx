import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';
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

export function LogoOverlay({ frameRef, logo, onLogoChange, onInteractionStart, onInteractionEnd }: LogoOverlayProps) {
  const [livePosition, setLivePosition] = useState({ positionX: logo.positionX, positionY: logo.positionY });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: logo.positionX, positionY: logo.positionY });
    }
  }, [logo.positionX, logo.positionY]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current?.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    onInteractionStart();
    isDraggingRef.current = true;

    const startX = event.clientX;
    const startY = event.clientY;
    const startPositionX = livePosition.positionX;
    const startPositionY = livePosition.positionY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newPositionX = clamp(startPositionX + (deltaX / frameRect.width) * 100, 0, 100);
      const newPositionY = clamp(startPositionY + (deltaY / frameRect.height) * 100, 0, 100);

      setLivePosition({ positionX: newPositionX, positionY: newPositionY });
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      onLogoChange({ positionX: livePosition.positionX, positionY: livePosition.positionY });
      isDraggingRef.current = false;
      onInteractionEnd();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
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