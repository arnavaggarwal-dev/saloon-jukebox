// From React Bits (reactbits.dev) — "Spotlight Card". Types removed.
import { useRef, useState } from 'react';

export default function SpotlightCard({ children, className = '', color = 'rgba(224,169,79,0.18)' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [on, setOn] = useState(0);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => setOn(0.6)}
      onMouseLeave={() => setOn(0)}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: on, background: `radial-gradient(circle at ${pos.x}px ${pos.y}px, ${color}, transparent 70%)` }}
      />
      {children}
    </div>
  );
}
