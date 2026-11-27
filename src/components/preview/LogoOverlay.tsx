import { getOrnamentContentBox } from '../../ornaments/contentBox';
import { OrnamentSelection } from '../../ornaments/selection';
import { useContext, useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  FC,
} from 'react';
import {
  getAnchoredDragBounds, getKeyboardDragBounds, getPreviewDragBounds, getPreviewPositioningRect,
  isArrowDirection, movePreviewPosition, nudgePreviewPosition,
} from '../../positioningRect';
import type { PreviewPositioningRect, RelativePosition } from '../../positioningRect';
import type { LogoConfig } from '../../types';

import { usePreviewPointerInteraction } from './previewInteraction';

interface LogoOverlayProps {
  ariaLabel: string;
  sizeLabel: string;
  effectiveScale: number;
  frameRef: RefObject<HTMLDivElement | null>;
  logo: LogoConfig;
  onLogoChange: (updates: Partial<LogoConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export const LogoOverlay: FC<LogoOverlayProps> = ({ ariaLabel, sizeLabel, effectiveScale, frameRef, logo, onLogoChange, onInteractionStart, onInteractionEnd }) => {
  const [livePosition, setLivePosition] = useState({ positionX: logo.positionX, positionY: logo.positionY });
  const [resizingTo, setResizingTo] = useState<number | null>(null);
  const [selectedOrnamentId, selectOrnament] = useContext(OrnamentSelection);
  const isSelected = Boolean(logo.ornamentId) && selectedOrnamentId === logo.id;
  const isDraggingRef = useRef(false);
  const beginPointerInteraction = usePreviewPointerInteraction(onInteractionStart, onInteractionEnd);
  const logoRef = useRef<HTMLDivElement>(null);

  /** The ornament's position is its image centre, which need not be the centre of its visible ink. */
  const anchorPoint = (frameRect: PreviewPositioningRect, position: RelativePosition) => ({
    x: frameRect.left + (frameRect.width * position.positionX) / 100,
    y: frameRect.top + (frameRect.height * position.positionY) / 100,
  });

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
    if (logo.ornamentId) selectOrnament(logo.id);
    const startPosition = livePosition;
    const startX = event.clientX;
    const startY = event.clientY;
    const livePositionRef = { current: startPosition };
    const bounds = logo.ornamentId
      ? getAnchoredDragBounds(frameRect, boxRect, anchorPoint(frameRect, startPosition))
      : getPreviewDragBounds(frameRect, boxRect);
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
    const bounds = logo.ornamentId && frameRect && boxRect
      ? getAnchoredDragBounds(frameRect, boxRect, anchorPoint(frameRect, livePosition))
      : getKeyboardDragBounds(frameRect, boxRect);
    const nextPosition = nudgePreviewPosition(livePosition, key, event.shiftKey, bounds);

    setLivePosition(nextPosition);
    onLogoChange(nextPosition);
  };

  function handleResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!logoRef.current || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    selectOrnament(logo.id);
    // Size scales about the image centre, which is the ornament's position.
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const rect = logoRef.current.getBoundingClientRect();
    const { x: centerX, y: centerY } = frameRect
      ? anchorPoint(frameRect, livePosition)
      : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const radius = (x: number, y: number) => Math.hypot(x - centerX, y - centerY);
    const initialRadius = Math.max(1, radius(event.clientX, event.clientY));
    let size = logo.size;
    beginPointerInteraction(event.pointerId, {
      onMove: move => {
        size = Math.max(12, logo.size * radius(move.clientX, move.clientY) / initialRadius);
        setResizingTo(size);
      },
      onCommit: () => {
        onLogoChange({ size });
        setResizingTo(null);
      },
      onCancel: () => setResizingTo(null),
    });
  }

  const size = resizingTo ?? logo.size;
  const common: CSSProperties = { position: 'absolute', cursor: 'grab', userSelect: 'none' };
  // An ornament's box is its visible ink, so the transparent margin of its
  // square image neither blocks the canvas edge nor catches taps. The image
  // keeps the full size × size square, centred on the position and rotated
  // about that centre, exactly as the export draws it.
  const [contentLeft, contentTop, contentRight, contentBottom] = getOrnamentContentBox(logo.ornamentId, logo.flipped);
  const style: CSSProperties = logo.ornamentId ? {
    ...common,
    left: `calc(${livePosition.positionX}% + ${(contentLeft - 0.5) * size}px)`,
    top: `calc(${livePosition.positionY}% + ${(contentTop - 0.5) * size}px)`,
    width: `${(contentRight - contentLeft) * size}px`,
    height: `${(contentBottom - contentTop) * size}px`,
    transform: `rotate(${logo.rotation}deg)`,
    transformOrigin: `${(0.5 - contentLeft) * size}px ${(0.5 - contentTop) * size}px`,
    zIndex: logo.aboveText ? 2147483647 : 1,
  } : {
    ...common,
    left: `${livePosition.positionX}%`,
    top: `${livePosition.positionY}%`,
    transform: 'translate(-50%, -50%)',
    width: `${size}px`,
    height: `${size}px`,
    opacity: logo.opacity,
    transformOrigin: 'center',
    rotate: `${logo.rotation}deg`,
    zIndex: (logo.zIndex ?? 0) + 20,
  };
  const imageStyle: CSSProperties = logo.ornamentId ? {
    position: 'absolute',
    left: `${-contentLeft * size}px`,
    top: `${-contentTop * size}px`,
    width: `${size}px`,
    height: `${size}px`,
    maxWidth: 'none',
    opacity: logo.opacity,
    transform: logo.flipped ? 'scaleX(-1)' : undefined,
  } : { transform: logo.flipped ? 'scaleX(-1)' : undefined };

  return (
    <div
      ref={logoRef}
      style={style}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyboardMove}
      onFocus={() => { if (logo.ornamentId) selectOrnament(logo.id); }}
      tabIndex={0}
      aria-label={ariaLabel}
      className="group absolute touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(20, 169, 155,0.45)]"
    >
      <img
        src={logo.imageUrl}
        alt={logo.ornamentId ? ariaLabel : "Logo"}
        style={imageStyle}
        className={logo.ornamentId ? 'object-contain' : 'w-full h-full object-contain'}
        draggable={false}
      />
      {logo.ornamentId && ['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((corner, index, corners) => <button
        key={corner}
        aria-label={sizeLabel}
        // One keyboard stop per ornament; the other corners are pointer-only.
        tabIndex={index === corners.length - 1 ? 0 : -1}
        aria-hidden={index === corners.length - 1 ? undefined : true}
        // Hidden handles must not catch touches meant to drag the ornament.
        className={`absolute ${corner} h-4 w-4 rounded-full border bg-white cursor-nwse-resize ${isSelected ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}`}
        style={{ scale: 1 / effectiveScale }}
        onPointerDown={handleResize}
        onKeyDown={event => {
          if (!isArrowDirection(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
          onLogoChange({ size: Math.max(12, logo.size + direction * (event.shiftKey ? 10 : 1)) });
        }}
      />)}
    </div>
  );
}
