import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useCanvasScale(
  containerRef: RefObject<HTMLDivElement | null>,
  canvasWidth: number,
  canvasHeight: number,
) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) {
        return;
      }

      const { clientWidth, clientHeight } = containerRef.current;
      const availableWidth = clientWidth - 64;
      const availableHeight = clientHeight - 64;
      const scaleX = availableWidth / canvasWidth;
      const scaleY = availableHeight / canvasHeight;

      setScale(Math.min(scaleX, scaleY, 1));
    };

    updateScale();
    window.addEventListener('resize', updateScale);

    return () => window.removeEventListener('resize', updateScale);
  }, [containerRef, canvasWidth, canvasHeight]);

  return scale;
}