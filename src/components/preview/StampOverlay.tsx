import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { getPreviewDragBounds, getPreviewPositioningRect } from '../../positioningRect';
import {
  getStampAppearance,
  getBrushStampSkew,
  getStampCharacters,
  getStampCssBackground,
  getStampCssBorderRadius,
  getStampTextFontSize,
  getStampTextLetterSpacing,
  getStampTextPlacements,
  STAMP_EDGE_WEAR_BLOBS,
  STAMP_TEXTURE_BLOBS,
} from '../../stampRendering';
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
  const appearance = getStampAppearance(stamp);
  const borderRadius = getStampCssBorderRadius(stamp.style, stamp.size);
  const transform = `rotate(${stamp.rotation}deg)${stamp.style === 'brush' ? ` skew(${skewXDeg}deg, ${skewYDeg}deg)` : ''}`;

  return {
    width: `${stamp.size}px`,
    height: `${stamp.size}px`,
    opacity: stamp.opacity,
    color: appearance.textColor,
    borderRadius,
    overflow: 'hidden',
    background: getStampCssBackground([appearance.baseFill]),
    boxShadow: appearance.previewBoxShadow,
    transform,
  };
}

export function StampOverlay({ frameRef, stamp, onStampChange, onInteractionStart, onInteractionEnd }: StampOverlayProps) {
  const appearance = getStampAppearance(stamp);
  const characters = getStampCharacters(stamp.text);
  const fontSize = getStampTextFontSize(stamp.size, characters.length);
  const letterSpacing = getStampTextLetterSpacing(stamp.size, characters.length);
  const placements = getStampTextPlacements(stamp.size, characters.length);
  const [livePosition, setLivePosition] = useState({ positionX: stamp.positionX, positionY: stamp.positionY });
  const isDraggingRef = useRef(false);

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
        className="pointer-events-auto relative flex cursor-move touch-none select-none items-center justify-center"
        style={{
          ...getFrameStyle(stamp),
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: getStampCssBackground(appearance.surfaceLayers), borderRadius: 'inherit' }}
        />

        {STAMP_TEXTURE_BLOBS.map((blob, index) => (
          <div
            key={`stamp-texture-${index}`}
            className="pointer-events-none absolute"
            style={{
              left: `${blob.x * 100}%`,
              top: `${blob.y * 100}%`,
              width: `${stamp.size * blob.radius * 2 * blob.scaleX}px`,
              height: `${stamp.size * blob.radius * 2 * blob.scaleY}px`,
              transform: `translate(-50%, -50%) rotate(${blob.rotationDeg}deg)`,
              borderRadius: '999px',
              background: appearance.textureColors[blob.tint],
              filter: `blur(${Math.max(1.2, stamp.size * blob.blur)}px)`,
            }}
          />
        ))}

        {STAMP_EDGE_WEAR_BLOBS.map((blob, index) => (
          <div
            key={`stamp-edge-${index}`}
            className="pointer-events-none absolute"
            style={{
              left: `${blob.x * 100}%`,
              top: `${blob.y * 100}%`,
              width: `${stamp.size * blob.radius * 2 * blob.scaleX}px`,
              height: `${stamp.size * blob.radius * 2 * blob.scaleY}px`,
              transform: `translate(-50%, -50%) rotate(${blob.rotationDeg}deg)`,
              borderRadius: '999px',
              background: appearance.textureColors[blob.tint],
              filter: `blur(${Math.max(0.8, stamp.size * blob.blur)}px)`,
            }}
          />
        ))}

        <div
          className="pointer-events-none absolute"
          style={{
            inset: `${Math.max(stamp.size * 0.15, 14)}px`,
            borderRadius: 'inherit',
            background: getStampCssBackground([appearance.centerGlow]),
          }}
        />

        <div className="pointer-events-none absolute inset-0">
          {characters.map((character, index) => {
            const placement = placements[index] ?? placements[placements.length - 1];

            return (
              <span
                key={`${character}-${index}`}
                className="absolute text-center font-bold"
                style={{
                  left: `calc(50% + ${placement.x}px)`,
                  top: `calc(50% + ${placement.y}px)`,
                  transform: `translate(-50%, -50%) rotate(${placement.rotateDeg}deg) scale(${placement.scale})`,
                  fontFamily: stamp.fontFamily,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1,
                  letterSpacing: `${letterSpacing}px`,
                  color: appearance.textColor,
                  textShadow: `0 0 ${appearance.textShadowBlur}px ${appearance.textShadowColor}`,
                }}
              >
                {character}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
