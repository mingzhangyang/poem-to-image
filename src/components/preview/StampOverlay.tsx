import type { CSSProperties, RefObject } from 'react';
import { motion } from 'motion/react';
import type { StampConfig } from '../../types';

interface StampOverlayProps {
  frameRef: RefObject<HTMLDivElement | null>;
  stamp: StampConfig;
  onStampChange: (updates: Partial<StampConfig>) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFrameStyle(stamp: StampConfig): CSSProperties {
  const borderWidth = Math.max(3, Math.round(stamp.size * 0.06));
  const shared: CSSProperties = {
    width: `${stamp.size}px`,
    height: `${stamp.size}px`,
    opacity: stamp.opacity,
    color: '#b91c1c',
    borderWidth: `${borderWidth}px`,
    borderColor: 'rgba(185, 28, 28, 0.92)',
    boxShadow: '0 10px 24px rgba(127, 29, 29, 0.18), inset 0 0 0 1.5px rgba(127, 29, 29, 0.38), inset 0 0 18px rgba(185, 28, 28, 0.16)',
  };

  if (stamp.style === 'round') {
    return {
      ...shared,
      borderRadius: '999px',
      background: 'radial-gradient(circle at 28% 30%, rgba(255,255,255,0.48), transparent 32%), radial-gradient(circle at 64% 62%, rgba(185,28,28,0.14), transparent 42%), rgba(254, 242, 242, 0.16)',
    };
  }

  if (stamp.style === 'brush') {
    return {
      ...shared,
      borderRadius: '32% 26% 34% 28% / 26% 34% 28% 36%',
      background: 'radial-gradient(circle at 34% 26%, rgba(255,255,255,0.4), transparent 28%), linear-gradient(145deg, rgba(185,28,28,0.18), rgba(153,27,27,0.28)), rgba(254, 242, 242, 0.1)',
      transform: `rotate(${stamp.rotation}deg) skew(-2deg, 1deg)`,
    };
  }

  return {
    ...shared,
    borderRadius: `${Math.round(stamp.size * 0.18)}px`,
    background: 'radial-gradient(circle at 26% 24%, rgba(255,255,255,0.52), transparent 30%), linear-gradient(135deg, rgba(185,28,28,0.1), rgba(153,27,27,0.22)), rgba(254, 242, 242, 0.12)',
  };
}

function getTextLayout(stamp: StampConfig): CSSProperties {
  const characters = Array.from(stamp.text || '印').slice(0, 4);

  if (characters.length <= 1) {
    return { display: 'grid', placeItems: 'center' };
  }

  if (characters.length === 2) {
    return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(2, minmax(0, 1fr))' };
  }

  return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))' };
}

export function StampOverlay({ frameRef, stamp, onStampChange }: StampOverlayProps) {
  const characters = Array.from(stamp.text || '印').slice(0, 4);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent) => {
    const frameRect = frameRef.current?.getBoundingClientRect();
    const stampRect = (event.currentTarget as HTMLDivElement | null)?.getBoundingClientRect();

    if (!frameRect || !stampRect) {
      return;
    }

    const centerX = stampRect.left + stampRect.width / 2;
    const centerY = stampRect.top + stampRect.height / 2;
    const positionX = clamp(((centerX - frameRect.left) / frameRect.width) * 100, 6, 94);
    const positionY = clamp(((centerY - frameRect.top) / frameRect.height) * 100, 6, 94);

    onStampChange({ positionX, positionY });
  };

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${stamp.positionX}%`,
        top: `${stamp.positionY}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <motion.div
        key={`${stamp.positionX}-${stamp.positionY}`}
        drag
        dragMomentum={false}
        dragConstraints={frameRef}
        onDragEnd={handleDragEnd}
        className="pointer-events-auto relative flex cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
        style={{
          ...getFrameStyle(stamp),
          rotate: stamp.style === 'brush' ? undefined : `${stamp.rotation}deg`,
        }}
      >
        <div className="absolute inset-[10%] rounded-[inherit] border border-red-800/45" />
        <div className="absolute inset-[18%] rounded-[inherit] bg-[radial-gradient(circle_at_50%_45%,rgba(220,38,38,0.14),transparent_65%)]" />
        <div
          className="relative h-[66%] w-[66%] items-center justify-center gap-1 text-center font-bold"
          style={{
            ...getTextLayout(stamp),
            fontFamily: '"Ma Shan Zheng", cursive',
            fontSize: `${Math.max(18, stamp.size * (characters.length > 2 ? 0.23 : 0.28))}px`,
            lineHeight: 1,
            letterSpacing: `${Math.max(0, stamp.size * 0.01)}px`,
            textShadow: '0 0 2px rgba(127, 29, 29, 0.28)',
          }}
        >
          {characters.map((character, index) => (
            <span key={`${character}-${index}`}>{character}</span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}