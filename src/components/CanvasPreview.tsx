import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { CanvasPreviewProps } from '../types';
import { BackgroundLayer } from './preview/BackgroundLayer';
import { CustomTextItems } from './preview/CustomTextItems';
import { PoemContent } from './preview/PoemContent';
import { TransparentGrid } from './preview/TransparentGrid';

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CanvasPreview({
  containerRef,
  previewRef,
  t,
  text,
  backgroundType,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  fontFamily,
  fontSize,
  textColor,
  textAlign,
  writingMode,
  padding,
  lineHeight,
  letterSpacing,
  columns,
  columnGap,
  textShadowEnabled,
  textShadowColor,
  textShadowBlur,
  textShadowOffsetY,
  textShadowOffsetX,
  showBorder,
  borderStyle,
  showStamp,
  stamp,
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  canvasWidth,
  canvasHeight,
  customTexts,
  onCustomTextChange,
  onInteractionStart,
  onInteractionEnd,
  previewZoom,
  onPreviewZoomChange,
  onPreviewZoomReset,
  scale,
}: CanvasPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // Refs for pinch-to-zoom
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);

  // Refs to keep callbacks fresh inside non-React event listeners
  const previewZoomRef = useRef(previewZoom);
  const onPreviewZoomChangeRef = useRef(onPreviewZoomChange);
  useEffect(() => { previewZoomRef.current = previewZoom; }, [previewZoom]);
  useEffect(() => { onPreviewZoomChangeRef.current = onPreviewZoomChange; }, [onPreviewZoomChange]);

  const sharedTextShadow = textShadowEnabled
    ? `${textShadowOffsetX}px ${textShadowOffsetY}px ${textShadowBlur}px ${textShadowColor}`
    : 'none';
  const effectiveScale = scale * previewZoom;
  const previewScalePercent = Math.round(effectiveScale * 100);
  const scaledWidth = canvasWidth * effectiveScale;
  const scaledHeight = canvasHeight * effectiveScale;
  const maxPanX = Math.max((scaledWidth - viewportSize.width) / 2, 0);
  const maxPanY = Math.max((scaledHeight - viewportSize.height) / 2, 0);
  const canPan = maxPanX > 0 || maxPanY > 0;

  useEffect(() => {
    const updateViewportSize = () => {
      if (!viewportRef.current) {
        return;
      }

      setViewportSize({
        width: viewportRef.current.clientWidth,
        height: viewportRef.current.clientHeight,
      });
    };

    const viewport = viewportRef.current;

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);

    const resizeObserver = typeof ResizeObserver === 'undefined' || !viewport
      ? null
      : new ResizeObserver(() => updateViewportSize());

    resizeObserver?.observe(viewport);

    return () => {
      window.removeEventListener('resize', updateViewportSize);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    setPan((currentPan) => ({
      x: clamp(currentPan.x, -maxPanX, maxPanX),
      y: clamp(currentPan.y, -maxPanY, maxPanY),
    }));
  }, [maxPanX, maxPanY]);

  // Ctrl+scroll (or Cmd+scroll on Mac) wheel zoom — non-passive so we can preventDefault
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // Scale deltaY to a reasonable zoom increment; clamp so one scroll tick isn't huge
      const delta = clamp(-e.deltaY * 0.003, -0.12, 0.12);
      const newZoom = clamp(previewZoomRef.current + delta, ZOOM_MIN, ZOOM_MAX);
      onPreviewZoomChangeRef.current(newZoom);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  const handleFitViewport = () => {
    setPan({ x: 0, y: 0 });
    onPreviewZoomReset();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Two+ pointers → pinch-to-zoom mode
    if (activePointersRef.current.size >= 2) {
      setIsDraggingPreview(false);
      const points = [...activePointersRef.current.values()];
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      pinchStartRef.current = { distance, zoom: previewZoomRef.current };
      return;
    }

    if (!canPan || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    dragStartRef.current = { x: event.clientX, y: event.clientY };
    panStartRef.current = pan;
    setIsDraggingPreview(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // Pinch zoom
    if (activePointersRef.current.size >= 2 && pinchStartRef.current) {
      const points = [...activePointersRef.current.values()];
      const currentDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const ratio = currentDistance / pinchStartRef.current.distance;
      const newZoom = clamp(pinchStartRef.current.zoom * ratio, ZOOM_MIN, ZOOM_MAX);
      onPreviewZoomChangeRef.current(newZoom);
      return;
    }

    if (!isDraggingPreview) {
      return;
    }

    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;

    setPan({
      x: clamp(panStartRef.current.x + deltaX, -maxPanX, maxPanX),
      y: clamp(panStartRef.current.y + deltaY, -maxPanY, maxPanY),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);

    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (!isDraggingPreview) {
      return;
    }

    setIsDraggingPreview(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={containerRef}
      className="order-1 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(191,214,213,0.34),transparent_34%),linear-gradient(180deg,rgba(255,250,242,0.6),rgba(246,243,236,0.92))] overflow-hidden relative h-dvh min-h-105 p-4 pt-6 pb-24 sm:p-6 md:order-2 md:flex-1 md:h-screen md:min-h-screen md:max-h-screen md:px-8 md:pb-8 md:pt-24"
    >
      <TransparentGrid visible={backgroundType === 'transparent'} />

      <div className="flex absolute right-4 top-4 z-20 items-center gap-1 rounded-full border border-[rgba(84,127,125,0.16)] bg-[rgba(255,253,249,0.72)] px-2.5 py-1.5 text-xs text-(--app-accent-700) shadow-[0_10px_24px_var(--app-accent-shadow)] backdrop-blur-sm opacity-70 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 md:right-6 md:top-6">
        <button
          type="button"
          onClick={() => onPreviewZoomChange(clamp(previewZoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className="flex items-center justify-center w-5 h-5 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors"
          aria-label="Zoom out"
        >
          <Minus size={11} />
        </button>

        <span className="min-w-8 text-center font-medium text-(--app-accent-900) tabular-nums">{previewScalePercent}%</span>

        <input
          type="range"
          min={Math.round(ZOOM_MIN * 100)}
          max={Math.round(ZOOM_MAX * 100)}
          step="1"
          value={Math.round(previewZoom * 100)}
          onChange={(event) => onPreviewZoomChange(Number(event.target.value) / 100)}
          className="hidden md:block h-1.5 w-20 cursor-pointer accent-(--app-accent-700)"
          aria-label={t('previewZoom')}
          title={t('previewZoom')}
        />

        <button
          type="button"
          onClick={() => onPreviewZoomChange(clamp(previewZoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className="flex items-center justify-center w-5 h-5 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors"
          aria-label="Zoom in"
        >
          <Plus size={11} />
        </button>

        <div className="w-px h-3 bg-[rgba(84,127,125,0.22)] mx-0.5" />

        <button
          type="button"
          onClick={handleFitViewport}
          className="flex items-center justify-center w-5 h-5 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors"
          aria-label={t('fitToViewport')}
          title={t('fitToViewport')}
        >
          <Maximize2 size={11} />
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`relative flex h-full w-full items-center justify-center overflow-hidden ${canPan ? (isDraggingPreview ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        {canPan ? (
          <>
            <div className="pointer-events-none absolute inset-3 rounded-[28px] border border-white/80 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1),0_0_0_1px_rgba(255,255,255,0.35)] md:inset-4" />
            <div className="pointer-events-none absolute inset-x-3 top-3 h-12 rounded-t-[28px] bg-linear-to-b from-white/22 to-transparent md:inset-x-4 md:top-4" />
            <div className="pointer-events-none absolute inset-x-3 bottom-3 h-12 rounded-b-[28px] bg-linear-to-t from-white/22 to-transparent md:inset-x-4 md:bottom-4" />
            <div className="pointer-events-none absolute inset-y-3 left-3 w-12 rounded-l-[28px] bg-linear-to-r from-white/18 to-transparent md:inset-y-4 md:left-4" />
            <div className="pointer-events-none absolute inset-y-3 right-3 w-12 rounded-r-[28px] bg-linear-to-l from-white/18 to-transparent md:inset-y-4 md:right-4" />
            <div className="pointer-events-none absolute left-3 top-3 h-6 w-6 rounded-tl-[20px] border-l-2 border-t-2 border-white/90 md:left-4 md:top-4" />
            <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 rounded-tr-[20px] border-r-2 border-t-2 border-white/90 md:right-4 md:top-4" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 rounded-bl-[20px] border-b-2 border-l-2 border-white/90 md:bottom-4 md:left-4" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 rounded-br-[20px] border-b-2 border-r-2 border-white/90 md:bottom-4 md:right-4" />
          </>
        ) : null}

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isDraggingPreview ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <div style={{ transform: `scale(${effectiveScale})`, transformOrigin: 'center', transition: isDraggingPreview ? 'none' : 'transform 0.2s ease-out' }}>
            <div
              className="relative shadow-2xl flex items-center justify-center overflow-hidden"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
              }}
            >
              <div
                ref={previewRef}
                className="w-full h-full flex items-center justify-center relative overflow-hidden"
                style={{
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`,
                  padding: `${padding}px`,
                }}
              >
                <BackgroundLayer
                  backgroundType={backgroundType}
                  backgroundStyle={backgroundStyle}
                  bgBrightness={bgBrightness}
                  bgBlur={bgBlur}
                />

                <CustomTextItems
                  frameRef={previewRef}
                  customTexts={customTexts}
                  fontFamily={fontFamily}
                  lineHeight={lineHeight}
                  letterSpacing={letterSpacing}
                  sharedTextShadow={sharedTextShadow}
                  onCustomTextChange={onCustomTextChange}
                  onInteractionStart={onInteractionStart}
                  onInteractionEnd={onInteractionEnd}
                />

                <PoemContent
                  t={t}
                  text={text}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  textColor={textColor}
                  textAlign={textAlign}
                  writingMode={writingMode}
                  lineHeight={lineHeight}
                  letterSpacing={letterSpacing}
                  columnCount={columns}
                  columnGap={columnGap}
                  sharedTextShadow={sharedTextShadow}
                  showBorder={showBorder}
                  borderStyle={borderStyle}
                  showStamp={showStamp}
                  stamp={stamp}
                  poemPosition={poemPosition}
                  onPoemPositionChange={onPoemPositionChange}
                  onStampChange={onStampChange}
                  onInteractionStart={onInteractionStart}
                  onInteractionEnd={onInteractionEnd}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
