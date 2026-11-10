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
import { drawSignatureToCanvas, ensureSignatureFontsLoaded, getSignatureCanvasSize } from '../../signatureRendering';
import type { SignatureConfig } from '../../types';

interface SignatureOverlayProps {
  ariaLabel: string;
  frameRef: RefObject<HTMLDivElement | null>;
  signature: SignatureConfig;
  onSignatureChange: (updates: Partial<SignatureConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export const SignatureOverlay: FC<SignatureOverlayProps> = ({
  ariaLabel,
  frameRef,
  signature,
  onSignatureChange,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [livePosition, setLivePosition] = useState({
    positionX: signature.positionX,
    positionY: signature.positionY,
  });
  const isDraggingRef = useRef(false);
  const signatureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width: canvasWidth, height: canvasHeight } = getSignatureCanvasSize(signature.fontSize);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLivePosition({ positionX: signature.positionX, positionY: signature.positionY });
    }
  }, [signature.positionX, signature.positionY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
    const paint = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      drawSignatureToCanvas(ctx, signature, canvasWidth, canvasHeight);
    };
    // Display a provisional frame immediately. Signature fonts are requested
    // by the actual canvas consumer, not indirectly by a prior editor action:
    // restored signatures, newly added signatures and undo all share one path.
    paint();

    void ensureSignatureFontsLoaded().then(async () => {
      // document.fonts.ready alone does not fetch a stylesheet that was never
      // installed; request the face used by this particular signature.
      if ('fonts' in document) {
        try {
          await document.fonts.load(`${signature.fontSize}px "${signature.font}"`, signature.text);
        } catch {
          // Offline font failure still leaves the provisional fallback visible.
        }
      }
      if (active && canvasRef.current === canvas) paint();
    }).catch(() => {
      if (active && canvasRef.current === canvas) paint();
    });

    return () => { active = false; };
  }, [signature, canvasWidth, canvasHeight]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = event.currentTarget.getBoundingClientRect();

    if (!frameRect || (event.pointerType === 'mouse' && event.button !== 0)) return;

    event.preventDefault();
    event.stopPropagation();
    onInteractionStart();
    isDraggingRef.current = true;

    const bounds = getPreviewDragBounds(frameRect, boxRect);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = livePosition;
    const liveRef = { current: startPosition };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const nextPosition = movePreviewPosition(startPosition, {
        x: e.clientX - startX,
        y: e.clientY - startY,
      }, frameRect, bounds);
      liveRef.current = nextPosition;
      setLivePosition(liveRef.current);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      onSignatureChange(liveRef.current);
      isDraggingRef.current = false;
      onInteractionEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleKeyboardMove = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (!isArrowDirection(key)) return;
    event.preventDefault();
    event.stopPropagation();

    const frameRect = frameRef.current ? getPreviewPositioningRect(frameRef.current) : null;
    const boxRect = signatureRef.current?.getBoundingClientRect();
    const bounds = getKeyboardDragBounds(frameRect, boxRect);
    const nextPosition = nudgePreviewPosition(livePosition, key, event.shiftKey, bounds);

    setLivePosition(nextPosition);
    onSignatureChange(nextPosition);
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: `${livePosition.positionX}%`,
    top: `${livePosition.positionY}%`,
    transform: 'translate(-50%, -50%)',
    width: `${canvasWidth}px`,
    height: `${canvasHeight}px`,
    opacity: signature.opacity,
    rotate: `${signature.rotation}deg`,
    cursor: 'move',
    userSelect: 'none',
    zIndex: (signature.zIndex ?? 0) + 30,
  };

  return (
    <div
      ref={signatureRef}
      style={style}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyboardMove}
      tabIndex={0}
      aria-label={ariaLabel}
      className="absolute touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(20, 169, 155,0.45)]"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
