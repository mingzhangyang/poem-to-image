import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import {
  getKeyboardDragBounds, getPreviewDragBounds, getPreviewPositioningRect,
  isArrowDirection, movePreviewPosition, nudgePreviewPosition,
} from '../../positioningRect';
import {
  getStampCharacters,
  getStampDimensions,
  getStampPreviewRasterDimensions,
  getStampTransform,
  STAMP_SHADOW_PADDING,
} from '../../stampRendering';
import { drawStampImpression } from '../../export/stampDraw';
import { isSealMotifId } from '../../sealMotifs';
import { useFontLayoutRevision } from '../../hooks/useFontLayoutRevision';
import type { StampConfig } from '../../types';

import { usePreviewPointerInteraction } from './previewInteraction';

interface StampOverlayProps {
  ariaLabel: string;
  frameRef: RefObject<HTMLDivElement | null>;
  stamp: StampConfig;
  effectiveScale: number;
  isPinching?: boolean;
  onStampChange: (updates: Partial<StampConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function getFrameStyle(stamp: StampConfig): CSSProperties {
  const { a, b, c, d } = getStampTransform(stamp);
  return {
    ...getStampDimensions(stamp),
    opacity: stamp.opacity,
    // The ink outline itself comes from Canvas, not a different CSS radius.
    transform: 'matrix(' + [a, b, c, d, 0, 0].join(', ') + ')',
  };
}

export function StampOverlay({ ariaLabel, frameRef, stamp, effectiveScale, isPinching = false, onStampChange, onInteractionStart, onInteractionEnd }: StampOverlayProps) {
  const [livePosition, setLivePosition] = useState({ positionX: stamp.positionX, positionY: stamp.positionY });
  const isDraggingRef = useRef(false);
  const beginPointerInteraction = usePreviewPointerInteraction(onInteractionStart, onInteractionEnd);
  const stampRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep the backing bitmap stable during a pinch; CSS scales it temporarily.
  const [rasterEffectiveScale, setRasterEffectiveScale] = useState(effectiveScale);
  useEffect(() => {
    if (!isPinching) setRasterEffectiveScale(effectiveScale);
  }, [effectiveScale, isPinching]);
  const hasMotif = isSealMotifId(stamp.motifId);
  const fontRevision = useFontLayoutRevision(hasMotif ? '' : stamp.fontFamily,
    hasMotif ? '' : getStampCharacters(stamp.text).join(''));
  const lastPaintKeyRef = useRef<string | null>(null);
  const [devicePixelRatio, setDevicePixelRatio] = useState(() =>
    typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1),
  );

  useEffect(() => {
    let resolutionQuery: MediaQueryList | null = null;
    const updatePixelRatio = () => {
      const nextRatio = window.devicePixelRatio || 1;
      setDevicePixelRatio(nextRatio);
      // Moving between monitors can change DPR without a React prop update.
      // Re-arm the resolution query at the device's new pixel ratio.
      resolutionQuery?.removeEventListener('change', updatePixelRatio);
      resolutionQuery = window.matchMedia ? window.matchMedia(`(resolution: ${nextRatio}dppx)`) : null;
      resolutionQuery?.addEventListener('change', updatePixelRatio);
    };
    updatePixelRatio();
    window.addEventListener('resize', updatePixelRatio);
    return () => {
      window.removeEventListener('resize', updatePixelRatio);
      resolutionQuery?.removeEventListener('change', updatePixelRatio);
    };
  }, []);

  const { width, height } = getStampDimensions(stamp);
  const logicalWidth = width + STAMP_SHADOW_PADDING * 2;
  const logicalHeight = height + STAMP_SHADOW_PADDING * 2;
  // Allocate bounded rectangular backing pixels before the first paint.
  const { widthPixels, heightPixels, scale: rasterScale } = getStampPreviewRasterDimensions(
    stamp, rasterEffectiveScale, devicePixelRatio,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Position, rotation and opacity are applied to the outer CSS element;
    // they must not regenerate the ink bitmap on pointer moves or keyboard
    // nudges. A stable key also avoids any plan recomputation during unrelated
    // React updates. Font readiness and backing resolution DO repaint.
    const paintKey = JSON.stringify([
      stamp.text, stamp.motifId, stamp.style, stamp.size, stamp.fontFamily, stamp.mode,
      stamp.colorScheme, stamp.inkColor, stamp.weathering,
      stamp.textScale, stamp.textStrokeWidthPct, stamp.shapeRatio,
      stamp.textureStyle, stamp.textureSeed, widthPixels, heightPixels, rasterScale, fontRevision,
    ]);
    if (lastPaintKeyRef.current === paintKey) return;
    canvas.width = widthPixels;
    canvas.height = heightPixels;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(rasterScale, 0, 0, rasterScale, 0, 0);
    ctx.translate(STAMP_SHADOW_PADDING + width / 2, STAMP_SHADOW_PADDING + height / 2);
    drawStampImpression(ctx, stamp, {
      pixelScale: rasterScale,
      applyTransform: false,
      applyOpacity: false,
    });
    lastPaintKeyRef.current = paintKey;
  }, [stamp, fontRevision, devicePixelRatio, width, height, widthPixels, heightPixels, rasterScale]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: stamp.positionX, positionY: stamp.positionY });
    }
  }, [stamp.positionX, stamp.positionY]);

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
        onStampChange(livePositionRef.current);
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
    const boxRect = stampRef.current?.getBoundingClientRect();
    const bounds = getKeyboardDragBounds(frameRect, boxRect);
    const nextPosition = nudgePreviewPosition(livePosition, key, event.shiftKey, bounds);

    setLivePosition(nextPosition);
    onStampChange(nextPosition);
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
        ref={stampRef}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyboardMove}
        tabIndex={0}
        aria-label={ariaLabel}
        className="pointer-events-auto relative cursor-move touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(20, 169, 155,0.45)]"
        style={{
          ...getFrameStyle(stamp),
        }}
      >
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute"
          width={widthPixels}
          height={heightPixels}
          style={{
            left: -STAMP_SHADOW_PADDING,
            top: -STAMP_SHADOW_PADDING,
            width: logicalWidth,
            height: logicalHeight,
          }}
        />
      </div>
    </div>
  );
}
