interface TransparentGridProps {
  visible: boolean;
}

export function TransparentGrid({ visible }: TransparentGridProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(45deg, rgba(34,48,52,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(34,48,52,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(34,48,52,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(34,48,52,0.06) 75%)',
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    />
  );
}
