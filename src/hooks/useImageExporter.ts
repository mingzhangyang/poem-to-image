import { useCallback, useState } from 'react';
import { toBlob } from 'html-to-image';
import type { RefObject } from 'react';
import type { ExportScale } from '../types';

export function useImageExporter(
  previewRef: RefObject<HTMLDivElement | null>,
  canvasWidth: number,
  canvasHeight: number,
  exportScale: ExportScale,
) {
  const [isExporting, setIsExporting] = useState(false);

  const exportImage = useCallback(() => {
    if (previewRef.current === null || isExporting) {
      return;
    }

    setIsExporting(true);

    toBlob(previewRef.current, {
      cacheBust: true,
      pixelRatio: exportScale,
      canvasWidth,
      canvasHeight,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
    })
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'poem-image.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
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
