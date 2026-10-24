import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Download, Maximize2, Minus, Plus, Undo2, Redo2, X } from 'lucide-react';
import type { CanvasPreviewProps } from '../types';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { BackgroundLayer } from './preview/BackgroundLayer';
import { PoemContent } from './preview/PoemContent';
import { TransparentGrid } from './preview/TransparentGrid';
import { useDialogA11y } from '../hooks/useDialogA11y';

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CanvasPreview({
  containerRef,
  previewRef,
  poemFrameRef,
  poemTextRef,
  t,
  poem,
  poemStyle,
  backgroundType,
  backgroundImage,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  fontFamily,
  fontSize,
  textColor,
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
  borderColor,
  borderWidth,
  showStamp,
  stamp,
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  canvasWidth,
  canvasHeight,
  customTexts,
  onCustomTextChange,
  logos,
  onLogoChange,
  signatures,
  onSignatureChange,
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  onDownload,
  onShare,
  isExporting,
  isSharing,
  canShare,
  onInteractionStart,
  onInteractionEnd,
  previewZoom,
  onPreviewZoomChange,
  onPreviewZoomReset,
  scale,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CanvasPreviewProps) {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const exportDialogRef = useRef<HTMLDivElement>(null);
  const closeExportModal = useCallback(() => setIsExportModalOpen(false), []);

  useDialogA11y({ isOpen: isExportModalOpen, dialogRef: exportDialogRef, onClose: closeExportModal });

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
  // The slider controls zoom relative to the fitted canvas, not its pixel-to-CSS scale.
  const previewScalePercent = Math.round(previewZoom * 100);
  const scaledWidth = canvasWidth * effectiveScale;
  const scaledHeight = canvasHeight * effectiveScale;
  const isOutputBusy = isExporting || isSharing;
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

    if (resizeObserver && viewport) {
      resizeObserver.observe(viewport);
    }

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

  const handleOpenExportModal = () => {
    if (isOutputBusy) {
      return;
    }

    setIsExportModalOpen(true);
  };

  const handleSaveFromModal = () => {
    onDownload();
    closeExportModal();
  };

  const handleShareFromModal = () => {
    onShare();
    closeExportModal();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }

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
      className="order-1 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(191,214,213,0.34),transparent_34%),linear-gradient(180deg,rgba(255,250,242,0.6),rgba(246,243,236,0.92))] overflow-hidden relative h-dvh min-h-105 p-4 pt-6 pb-24 sm:p-6 lg:order-2 lg:flex-1 lg:h-screen lg:min-h-screen lg:max-h-screen lg:px-8 lg:pb-8 lg:pt-24"
    >
      <TransparentGrid visible={backgroundType === 'transparent'} />

      <div className="flex absolute left-[calc(4.25rem+env(safe-area-inset-left))] top-4 z-20 items-center gap-1 rounded-full border border-[rgba(20,169,155,0.16)] bg-[rgba(255,253,249,0.72)] px-1.5 py-1 text-xs text-(--app-accent-700) shadow-[0_10px_24px_var(--app-accent-shadow)] backdrop-blur-sm opacity-80 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 lg:left-6 lg:top-6">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="app-icon-button flex items-center justify-center w-9 h-9 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors disabled:opacity-30 disabled:cursor-not-allowed lg:w-10 lg:h-10"
          aria-label={t('undo')}
          title={`${t('undo')} (Ctrl+Z)`}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="app-icon-button flex items-center justify-center w-9 h-9 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors disabled:opacity-30 disabled:cursor-not-allowed lg:w-10 lg:h-10"
          aria-label={t('redo')}
          title={`${t('redo')} (Ctrl+Y)`}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="flex absolute right-4 top-4 z-20 items-center gap-0.5 rounded-full border border-[rgba(20,169,155,0.16)] bg-[rgba(255,253,249,0.72)] px-1.5 py-1 text-xs text-(--app-accent-700) shadow-[0_10px_24px_var(--app-accent-shadow)] backdrop-blur-sm opacity-80 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 lg:right-6 lg:top-6">
        <button
          type="button"
          onClick={() => onPreviewZoomChange(clamp(previewZoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className="app-icon-button flex items-center justify-center w-9 h-9 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors lg:w-10 lg:h-10"
          aria-label={t('zoomOut')}
        >
          <Minus size={14} />
        </button>

        <span className="min-w-8 text-center font-medium text-(--app-accent-900) tabular-nums">{previewScalePercent}%</span>

        <input
          type="range"
          min={Math.round(ZOOM_MIN * 100)}
          max={Math.round(ZOOM_MAX * 100)}
          step="1"
          value={Math.round(previewZoom * 100)}
          onChange={(event) => onPreviewZoomChange(Number(event.target.value) / 100)}
          className="hidden lg:block h-1.5 w-20 cursor-pointer accent-(--app-accent-700)"
          aria-label={t('previewZoom')}
          title={t('previewZoom')}
        />

        <button
          type="button"
          onClick={() => onPreviewZoomChange(clamp(previewZoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className="app-icon-button flex items-center justify-center w-9 h-9 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors lg:w-10 lg:h-10"
          aria-label={t('zoomIn')}
        >
          <Plus size={14} />
        </button>

        <div className="w-px h-3 bg-[rgba(20, 169, 155,0.22)] mx-0.5" />

        <button
          type="button"
          onClick={handleFitViewport}
          className="app-icon-button flex items-center justify-center w-9 h-9 rounded-full text-(--app-accent-700) hover:bg-(--app-accent-50) hover:text-(--app-accent-900) transition-colors lg:w-10 lg:h-10"
          aria-label={t('fitToViewport')}
          title={t('fitToViewport')}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={handleOpenExportModal}
        disabled={isOutputBusy}
        className="app-button-primary hidden lg:flex absolute bottom-6 right-6 z-20 items-center justify-center gap-2 rounded-2xl border border-white/70 px-5 py-3 text-sm font-semibold shadow-[0_20px_48px_var(--app-accent-shadow)] backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Download className="h-4 w-4" />
        {t(canShare ? 'exportAndShare' : 'exportImage')}
      </button>

      <AnimatePresence>
        {isExportModalOpen ? (
          <>
            <motion.button
              type="button"
              className="hidden lg:block fixed inset-0 z-30 bg-[rgba(31,52,54,0.36)] backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeExportModal}
              aria-label={t('closeControls')}
            />

            <motion.div
              className="hidden lg:flex fixed inset-0 z-40 items-center justify-center p-6"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            >
              <div
                ref={exportDialogRef}
                className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,253,249,0.98),rgba(255,250,242,0.96))] shadow-[0_28px_80px_var(--app-accent-shadow)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-dialog-title"
                aria-describedby="export-dialog-description"
                tabIndex={-1}
              >
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(34,48,52,0.06)] px-6 py-5">
                  <div className="min-w-0">
                    <p id="export-dialog-title" className="text-xs font-semibold uppercase tracking-[0.24em] text-(--app-accent-500)">
                      {t(canShare ? 'exportAndShare' : 'exportImage')}
                    </p>
                    <p id="export-dialog-description" className="mt-2 text-sm leading-5 text-(--app-accent-700)">
                      {t('saveImageModalDescription')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeExportModal}
                    className="app-icon-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(34,48,52,0.08)] bg-white/80 p-0 text-(--app-accent-700) transition-colors hover:bg-(--app-accent-50)"
                    aria-label={t('closeControls')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-6 py-6">
                  <SidebarFooter
                    t={t}
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    exportFormat={exportFormat}
                    onExportFormatChange={onExportFormatChange}
                    exportScale={exportScale}
                    onExportScaleChange={onExportScaleChange}
                    onDownload={handleSaveFromModal}
                    onShare={handleShareFromModal}
                    isExporting={isExporting}
                    isSharing={isSharing}
                    canShare={canShare}
                    actionMode={canShare ? 'both' : 'save'}
                    surface="modal"
                  />
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

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
                  backgroundImage={backgroundImage}
                  backgroundStyle={backgroundStyle}
                  bgBrightness={bgBrightness}
                  bgBlur={bgBlur}
                  loadingLabel={t('loadingBalance')}
                />

                <PoemContent
                  poemFrameRef={poemFrameRef}
                  poemTextRef={poemTextRef}
                  t={t}
                  poem={poem}
                  poemStyle={poemStyle}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  textColor={textColor}
                  writingMode={writingMode}
                  lineHeight={lineHeight}
                  letterSpacing={letterSpacing}
                  columnCount={columns}
                  columnGap={columnGap}
                  sharedTextShadow={sharedTextShadow}
                  showBorder={showBorder}
                  borderStyle={borderStyle}
                  borderColor={borderColor}
                  borderWidth={borderWidth}
                  showStamp={showStamp}
                  stamp={stamp}
                  customTexts={customTexts}
                  logos={logos}
                  signatures={signatures}
                  poemPosition={poemPosition}
                  onPoemPositionChange={onPoemPositionChange}
                  onStampChange={onStampChange}
                  onCustomTextChange={onCustomTextChange}
                  onLogoChange={onLogoChange}
                  onSignatureChange={onSignatureChange}
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
