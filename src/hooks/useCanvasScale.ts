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
      const computedStyle = window.getComputedStyle(containerRef.current);
      const horizontalPadding = Number.parseFloat(computedStyle.paddingLeft) + Number.parseFloat(computedStyle.paddingRight);
      const verticalPadding = Number.parseFloat(computedStyle.paddingTop) + Number.parseFloat(computedStyle.paddingBottom);
      const availableWidth = clientWidth - horizontalPadding;
      const availableHeight = clientHeight - verticalPadding;
      const scaleX = availableWidth / canvasWidth;
      const scaleY = availableHeight / canvasHeight;

      setScale(Math.min(scaleX, scaleY, 1));
    };

    const container = containerRef.current;

    updateScale();
    window.addEventListener('resize', updateScale);

    const resizeObserver = typeof ResizeObserver === 'undefined' || !container
      ? null
      : new ResizeObserver(() => updateScale());

    resizeObserver?.observe(container);

    return () => {
      window.removeEventListener('resize', updateScale);
      resizeObserver?.disconnect();
    };
  }, [containerRef, canvasWidth, canvasHeight]);

  return scale;
}