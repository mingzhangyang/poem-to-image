import { useCallback } from 'react';
import { toPng } from 'html-to-image';
import type { RefObject } from 'react';
import type { ExportScale } from '../types';

export function useImageExporter(
  previewRef: RefObject<HTMLDivElement | null>,
  canvasWidth: number,
  canvasHeight: number,
  exportScale: ExportScale,
) {
  return useCallback(() => {
    if (previewRef.current === null) {
      return;
    }

    toPng(previewRef.current, {
      cacheBust: true,
      pixelRatio: exportScale,
      canvasWidth,
      canvasHeight,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'poem-image.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((error) => {
        console.error('Failed to generate image', error);
      });
  }, [previewRef, canvasWidth, canvasHeight, exportScale]);
}