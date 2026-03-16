import { useCallback, useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import type { RefObject } from 'react';
import type { ExportScale } from '../types';

interface UseImageExporterBackgroundOptions {
  backgroundType: 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
  backgroundStyle: import('react').CSSProperties;
  bgBrightness: number;
  bgBlur: number;
  canvasWidth: number;
  canvasHeight: number;
}

const PRECOMPUTE_DEBOUNCE_MS = 800;

function renderToBlob(node: HTMLElement, canvasWidth: number, canvasHeight: number, exportScale: ExportScale) {
  return toBlob(node, {
    cacheBust: false,
    pixelRatio: exportScale,
    canvasWidth,
    canvasHeight,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
  });
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'poem-image.png';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function useImageExporter(
  previewRef: RefObject<HTMLDivElement | null>,
  exportScale: ExportScale,
  backgroundOptions: UseImageExporterBackgroundOptions,
) {
  const [isExporting, setIsExporting] = useState(false);
  const cachedBlobRef = useRef<Blob | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const versionRef = useRef(0);

  const { canvasWidth, canvasHeight } = backgroundOptions;

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;

    const precompute = () => {
      cachedBlobRef.current = null;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const version = ++versionRef.current;
        renderToBlob(node, canvasWidth, canvasHeight, exportScale)
          .then((blob) => {
            if (version === versionRef.current && blob) {
              cachedBlobRef.current = blob;
            }
          })
          .catch(() => {});
      }, PRECOMPUTE_DEBOUNCE_MS);
    };

    const observer = new MutationObserver(precompute);
    observer.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    precompute();

    return () => {
      observer.disconnect();
      clearTimeout(debounceTimerRef.current);
    };
  }, [previewRef, canvasWidth, canvasHeight, exportScale]);

  const exportImage = useCallback(() => {
    if (previewRef.current === null || isExporting) return;

    if (cachedBlobRef.current) {
      downloadBlob(cachedBlobRef.current);
      return;
    }

    setIsExporting(true);
    renderToBlob(previewRef.current, canvasWidth, canvasHeight, exportScale)
      .then((blob) => {
        if (!blob) return;
        cachedBlobRef.current = blob;
        downloadBlob(blob);
      })
      .catch((error) => {
        console.error('Failed to generate image', error);
      })
      .finally(() => {
        setIsExporting(false);
      });
  }, [previewRef, canvasWidth, canvasHeight, exportScale, isExporting]);

  return { exportImage, isExporting };
}
