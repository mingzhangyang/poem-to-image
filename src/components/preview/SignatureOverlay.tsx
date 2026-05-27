import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  FC,
} from 'react';
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

const KEYBOARD_MOVE_STEP = 1;
const KEYBOARD_MOVE_STEP_FAST = 3;

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
    const boxRect = signatureRef.current?.getBoundingClientRect();
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
      aria-label="Signature element"
      className="absolute touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(20, 169, 155,0.45)]"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
