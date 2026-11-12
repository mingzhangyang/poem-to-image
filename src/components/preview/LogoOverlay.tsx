import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  FC,
} from 'react';
import {
  getKeyboardDragBounds, getPreviewDragBounds, getPreviewPositioningRect,
  isArrowDirection, movePreviewPosition, nudgePreviewPosition,
} from '../../positioningRect';
import type { LogoConfig } from '../../types';

import { usePreviewPointerInteraction } from './previewInteraction';

interface LogoOverlayProps {
  ariaLabel: string;
  frameRef: RefObject<HTMLDivElement | null>;
  logo: LogoConfig;
  onLogoChange: (updates: Partial<LogoConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export const LogoOverlay: FC<LogoOverlayProps> = ({ ariaLabel, frameRef, logo, onLogoChange, onInteractionStart, onInteractionEnd }) => {
  const [livePosition, setLivePosition] = useState({ positionX: logo.positionX, positionY: logo.positionY });
  const isDraggingRef = useRef(false);
  const beginPointerInteraction = usePreviewPointerInteraction(onInteractionStart, onInteractionEnd);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: logo.positionX, positionY: logo.positionY });
    }
  }, [logo.positionX, logo.positionY]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = event.currentTarget.getBoundingClientRect();
    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) return;

    event.preventDefault();
    event.stopPropagation();
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    const livePositionRef = { current: startPosition };
    const bounds = getPreviewDragBounds(frameRect, boxRect);
    isDraggingRef.current = true;
    beginPointerInteraction(event.pointerId, {
      onMove: (moveEvent) => {
        const nextPosition = movePreviewPosition(startPosition, {
          x: moveEvent.clientX - startX, y: moveEvent.clientY - startY,
        }, frameRect, bounds);
        livePositionRef.current = nextPosition;
        setLivePosition(nextPosition);
      },
      onCommit: () => {
        isDraggingRef.current = false;
        onLogoChange(livePositionRef.current);
      },
      onCancel: () => {
        isDraggingRef.current = false;
        setLivePosition(startPosition);
      },
    });
  };

  const handleKeyboardMove = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (!isArrowDirection(key)) return;
    event.preventDefault();
    event.stopPropagation();

    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = logoRef.current?.getBoundingClientRect();
    const bounds = getKeyboardDragBounds(frameRect, boxRect);
    const nextPosition = nudgePreviewPosition(livePosition, key, event.shiftKey, bounds);

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
      aria-label={ariaLabel}
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
