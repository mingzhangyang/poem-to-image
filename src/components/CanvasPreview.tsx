import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Download, Maximize2, Minus, Plus, Share2, X } from 'lucide-react';
import type { CanvasPreviewProps, SocialPlatform } from '../types';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { BackgroundLayer } from './preview/BackgroundLayer';
import { CustomTextItems } from './preview/CustomTextItems';
import { PoemContent } from './preview/PoemContent';
import { TransparentGrid } from './preview/TransparentGrid';

const SOCIAL_PLATFORMS: Array<{
  id: SocialPlatform;
  label: string;
  color: string;
  bg: string;
  symbol: string;
}> = [
  { id: 'wechat',      label: 'WeChat',      color: '#fff', bg: '#07C160', symbol: '微' },
  { id: 'weibo',       label: '微博',         color: '#fff', bg: '#E6162D', symbol: '博' },
  { id: 'xiaohongshu', label: '小红书',       color: '#fff', bg: '#FF2442', symbol: '红' },
  { id: 'twitter',     label: 'X',           color: '#fff', bg: '#000000', symbol: '𝕏' },
  { id: 'instagram',   label: 'Instagram',   color: '#fff', bg: '#C13584', symbol: 'In' },
  { id: 'facebook',    label: 'Facebook',    color: '#fff', bg: '#1877F2', symbol: 'f' },
];

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

const exportFormatLabelKeys = {
  png: 'exportFormatPng',
  jpg: 'exportFormatJpg',
  webp: 'exportFormatWebp',
} as const;

type OutputModalMode = 'save' | 'share';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CanvasPreview({
  containerRef,
  previewRef,
  poemFrameRef,
  poemTextRef,
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
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  onDownload,
  onShare,
  onShareToSocial,
  isExporting,
  isSharing,
  canShare,
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
  const [activeOutputModal, setActiveOutputModal] = useState<OutputModalMode | null>(null);
  const [socialFeedback, setSocialFeedback] = useState<{ result: 'clipboard' | 'downloaded'; platform: SocialPlatform } | null>(null);
  const [activeSocialPlatform, setActiveSocialPlatform] = useState<SocialPlatform | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const exportSummary = `${t(exportFormatLabelKeys[exportFormat])} · ${canvasWidth * exportScale} x ${canvasHeight * exportScale} px`;
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

  useEffect(() => {
    if (!activeOutputModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveOutputModal(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeOutputModal]);

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

  const handleOpenSaveModal = () => {
    if (isOutputBusy) {
      return;
    }

    setActiveOutputModal('save');
  };

  const handleOpenShareModal = () => {
    if (isOutputBusy) {
      return;
    }

    setSocialFeedback(null);
    setActiveOutputModal('share');
  };

  const handleSaveFromModal = () => {
    onDownload();
    setActiveOutputModal(null);
  };

  const handleShareFromModal = () => {
    onShare();
    setActiveOutputModal(null);
  };

  const handleShareToSocial = async (platform: SocialPlatform) => {
    if (isOutputBusy) return;
    setActiveSocialPlatform(platform);
    setSocialFeedback(null);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    const result = await onShareToSocial(platform);
    setActiveSocialPlatform(null);
    setSocialFeedback({ result, platform });
    feedbackTimeoutRef.current = setTimeout(() => setSocialFeedback(null), 5000);
  };

  const modalTitle = activeOutputModal === 'save' ? t('saveImageModalTitle') : t('shareImageModalTitle');
  const modalDescription = activeOutputModal === 'save' ? t('saveImageModalDescription') : t('shareImageModalDescription');

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

      <div className="hidden md:flex absolute bottom-6 right-6 z-20 items-center gap-3 rounded-[1.6rem] border border-white/70 bg-[rgba(255,253,249,0.86)] p-3 shadow-[0_22px_56px_var(--app-accent-shadow)] backdrop-blur-md">
        <button
          type="button"
          onClick={handleOpenSaveModal}
          disabled={isOutputBusy}
          className="app-button-primary rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" />
          {t('saveImage')}
        </button>

        <button
          type="button"
          onClick={handleOpenShareModal}
          disabled={isOutputBusy}
          className="app-button-secondary rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Share2 className="h-4 w-4" />
          {t('shareImage')}
        </button>
      </div>

      <AnimatePresence>
        {activeOutputModal ? (
          <>
            <motion.button
              type="button"
              className="hidden md:block fixed inset-0 z-30 bg-[rgba(31,52,54,0.36)] backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveOutputModal(null)}
              aria-label={t('closeControls')}
            />

            <motion.div
              className="hidden md:flex fixed inset-0 z-40 items-center justify-center p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,253,249,0.98),rgba(255,250,242,0.96))] shadow-[0_28px_80px_var(--app-accent-shadow)]">
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(34,48,52,0.06)] px-6 py-5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--app-accent-500)">{modalTitle}</p>
                    <p className="mt-2 text-sm text-gray-600">{modalDescription}</p>
                    <p className="mt-2 text-sm font-medium text-(--app-accent-900)">{exportSummary}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveOutputModal(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(34,48,52,0.08)] bg-white/80 text-(--app-accent-700) transition-colors hover:bg-(--app-accent-50)"
                    aria-label={t('closeControls')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-6 py-6">
                  {activeOutputModal === 'share' ? (
                    <div className="mb-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--app-accent-500) mb-3">{t('shareToSocialTitle')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {SOCIAL_PLATFORMS.map((platform) => {
                          const isActive = activeSocialPlatform === platform.id;
                          return (
                            <button
                              key={platform.id}
                              type="button"
                              onClick={() => handleShareToSocial(platform.id)}
                              disabled={isOutputBusy}
                              className="flex flex-col items-center gap-2 rounded-2xl border border-[rgba(34,48,52,0.08)] bg-white/70 px-2 py-3 text-center transition-all hover:bg-white hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <span
                                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                                style={{ backgroundColor: platform.bg, color: platform.color }}
                              >
                                {isActive ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                ) : platform.symbol}
                              </span>
                              <span className="text-[11px] font-medium text-gray-700 leading-tight">{platform.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <AnimatePresence>
                        {socialFeedback ? (
                          <motion.div
                            className="mt-3 flex items-center gap-2 rounded-xl bg-(--app-accent-50) px-3 py-2.5 text-xs text-(--app-accent-800)"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-(--app-accent-600)" />
                            <span>{socialFeedback.result === 'clipboard' ? t('shareImageCopiedHint') : t('shareImageDownloadedHint')}</span>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <div className="mt-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[rgba(34,48,52,0.08)]" />
                        <span className="text-[11px] text-gray-400">{t('shareSystemDivider')}</span>
                        <div className="h-px flex-1 bg-[rgba(34,48,52,0.08)]" />
                      </div>
                    </div>
                  ) : null}

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
                    actionMode={activeOutputModal}
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
                  poemFrameRef={poemFrameRef}
                  poemTextRef={poemTextRef}
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
