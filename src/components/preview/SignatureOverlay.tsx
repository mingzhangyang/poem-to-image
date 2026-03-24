import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject, FC } from 'react';
import { getPreviewDragBounds, getPreviewPositioningRect } from '../../positioningRect';
import { drawSignatureToCanvas, getSignatureCanvasSize } from '../../signatureRendering';
import type { SignatureConfig } from '../../types';

interface SignatureOverlayProps {
  frameRef: RefObject<HTMLDivElement | null>;
  signature: SignatureConfig;
  onSignatureChange: (updates: Partial<SignatureConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const SignatureOverlay: FC<SignatureOverlayProps> = ({
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

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    document.fonts.ready.then(() => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      drawSignatureToCanvas(ctx, signature, canvasWidth, canvasHeight);
    });
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
    const startPositionX = livePosition.positionX;
    const startPositionY = livePosition.positionY;
    const liveRef = { current: { positionX: startPositionX, positionY: startPositionY } };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const newPositionX = clamp(
        startPositionX + ((e.clientX - startX) / frameRect.width) * 100,
        bounds.minPositionX,
        bounds.maxPositionX,
      );
      const newPositionY = clamp(
        startPositionY + ((e.clientY - startY) / frameRect.height) * 100,
        bounds.minPositionY,
        bounds.maxPositionY,
      );
      liveRef.current = { positionX: newPositionX, positionY: newPositionY };
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
      style={style}
      onPointerDown={handlePointerDown}
      className="absolute touch-none select-none"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
