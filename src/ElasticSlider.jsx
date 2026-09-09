// From React Bits (reactbits.dev) — "Elastic Slider". Types removed, plus a
// controlled value/onChange and keyboard + ARIA support (the original was
// pointer-only, which left volume unreachable without a mouse).
import { useRef, useState } from 'react';

const MAX = 50;
const decay = (v, max) => (max ? 2 * (1 / (1 + Math.exp(-v / max)) - 0.5) * max : 0);

export default function ElasticSlider({ value, onChange, label = 'Slider' }) {
  const ref = useRef(null);
  const [over, setOver] = useState(0);
  const [side, setSide] = useState('mid');

  const set = (v) => onChange(Math.min(1, Math.max(0, v)));

  const move = (e) => {
    if (!e.buttons || !ref.current) return;
    const { left, width, right } = ref.current.getBoundingClientRect();
    set((e.clientX - left) / width);
    if (e.clientX < left) { setSide('l'); setOver(decay(left - e.clientX, MAX)); }
    else if (e.clientX > right) { setSide('r'); setOver(decay(e.clientX - right, MAX)); }
    else { setSide('mid'); setOver(0); }
  };

  const key = (e) => {
    const step = e.key === 'PageUp' || e.key === 'PageDown' ? 0.2 : 0.05;
    const d = { ArrowRight: step, ArrowUp: step, PageUp: step, ArrowLeft: -step, ArrowDown: -step, PageDown: -step }[e.key];
    if (d === undefined && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    set(e.key === 'Home' ? 0 : e.key === 'End' ? 1 : value + d);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}%`}
      onKeyDown={key}
      onPointerMove={move}
      onPointerDown={(e) => { move(e); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={() => { setOver(0); setSide('mid'); }}
      className="flex w-full cursor-grab touch-none items-center py-3 select-none active:cursor-grabbing"
    >
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-wood-600 transition-transform"
        style={{ transform: `scaleX(${1 + over / 300}) scaleY(${over ? 0.85 : 1})`, transformOrigin: side === 'l' ? 'right' : 'left' }}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-brass-600 to-brass-300" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
