import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  FC,
} from 'react';
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

const KEYBOARD_MOVE_STEP = 1;
const KEYBOARD_MOVE_STEP_FAST = 3;

export const LogoOverlay: FC<LogoOverlayProps> = ({ frameRef, logo, onLogoChange, onInteractionStart, onInteractionEnd }) => {
  const [livePosition, setLivePosition] = useState({ positionX: logo.positionX, positionY: logo.positionY });
  const isDraggingRef = useRef(false);
  const logoRef = useRef<HTMLDivElement>(null);

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

  const handleKeyboardMove = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isArrowKey = event.key === 'ArrowLeft'
      || event.key === 'ArrowRight'
      || event.key === 'ArrowUp'
      || event.key === 'ArrowDown';

    if (!isArrowKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const step = event.shiftKey ? KEYBOARD_MOVE_STEP_FAST : KEYBOARD_MOVE_STEP;
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = logoRef.current?.getBoundingClientRect();
    const bounds = frameRect && boxRect
      ? getPreviewDragBounds(frameRect, boxRect)
      : {
          minPositionX: 0,
          maxPositionX: 100,
          minPositionY: 0,
          maxPositionY: 100,
        };
    const deltaX = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const deltaY = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const nextPosition = {
      positionX: clamp(livePosition.positionX + deltaX, bounds.minPositionX, bounds.maxPositionX),
      positionY: clamp(livePosition.positionY + deltaY, bounds.minPositionY, bounds.maxPositionY),
    };

    setLivePosition(nextPosition);
    onLogoChange(nextPosition);
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
      ref={logoRef}
      style={style}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyboardMove}
      tabIndex={0}
      aria-label="Logo element"
      className="absolute touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(20, 169, 155,0.45)]"
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
