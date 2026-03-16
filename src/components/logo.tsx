export function Logo({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="inkDrop">
          <path d="M256 48C256 48 112 240 112 352C112 431.5 176.5 496 256 496C335.5 496 400 431.5 400 352C400 240 256 48 256 48Z" />
        </clipPath>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="mountainGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="mountainGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      
      {/* Background (App Icon Shape) */}
      <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

      {/* Ink Drop Container */}
      <g clipPath="url(#inkDrop)">
        {/* Drop Background representing paper */}
        <rect x="112" y="48" width="288" height="448" fill="#f8fafc" />

        {/* Sun / Seal */}
        <circle cx="256" cy="220" r="48" fill="#ef4444" />

        {/* Abstract Poem Lines (Vertical for traditional Chinese poetry) */}
        <g stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round">
          <line x1="340" y1="120" x2="340" y2="280" />
          <line x1="310" y1="150" x2="310" y2="260" />
          <line x1="280" y1="100" x2="280" y2="200" />
        </g>

        {/* Mountains representing the generated image/landscape */}
        <path d="M80 420 L180 280 L260 360 L340 240 L440 420 Z" fill="url(#mountainGrad1)" />
        <path d="M150 450 L250 320 L320 380 L400 290 L480 450 Z" fill="url(#mountainGrad2)" />
      </g>

      {/* Ink Drop Outline / Tech Glow */}
      <path 
        d="M256 48C256 48 112 240 112 352C112 431.5 176.5 496 256 496C335.5 496 400 431.5 400 352C400 240 256 48 256 48Z" 
        fill="none" 
        stroke="#38bdf8" 
        strokeWidth="8" 
        opacity="0.8" 
      />
    </svg>
  );
}
