import { useId } from 'react';

import { formatTime } from '../lib/audio';

interface ScrubberProps {
  value: number;
  max: number;
  disabled?: boolean;
  onScrubStart: (value: number) => void;
  onScrub: (value: number) => void;
  onScrubEnd: (value: number) => void;
}

/**
 * Seek bar. A real <input type="range"> sits invisibly on top of the painted
 * track, so dragging, clicking, arrow keys, Home/End and screen-reader support
 * all come from the platform rather than being re-implemented (and half-broken).
 */
export function Scrubber({
  value,
  max,
  disabled = false,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: ScrubberProps) {
  const id = useId();
  const safeMax = max > 0 ? max : 0;
  const pct = safeMax > 0 ? Math.min(100, (value / safeMax) * 100) : 0;

  return (
    <div className="flex w-full items-center gap-2.5">
      <span
        className="text-parchment-400 w-10 shrink-0 text-right font-mono text-[11px] tabular-nums"
        aria-hidden="true"
      >
        {formatTime(value)}
      </span>

      <div className="group relative flex h-6 flex-1 items-center">
        {/* Painted track */}
        <div className="bg-wood-600/80 pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full">
          <div
            className="from-brass-600 via-brass-400 to-brass-300 h-full rounded-full bg-gradient-to-r transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Thumb */}
        <div
          className="bg-brass-200 pointer-events-none absolute size-3 -translate-x-1/2 rounded-full opacity-0 shadow-[0_0_10px_rgb(224_169_79/0.8)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
        <label htmlFor={id} className="sr-only">
          Seek within the current track
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={safeMax || 1}
          step={0.5}
          value={Math.min(value, safeMax || 1)}
          disabled={disabled || safeMax === 0}
          aria-valuetext={`${formatTime(value)} of ${formatTime(safeMax)}`}
          onPointerDown={(e) => onScrubStart(Number((e.target as HTMLInputElement).value))}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
              onScrubStart(value);
            }
          }}
          onChange={(e) => onScrub(Number(e.target.value))}
          onPointerUp={(e) => onScrubEnd(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => onScrubEnd(Number((e.target as HTMLInputElement).value))}
          onBlur={(e) => onScrubEnd(Number(e.target.value))}
          className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent"
        />
      </div>

      <span
        className="text-parchment-400 w-10 shrink-0 font-mono text-[11px] tabular-nums"
        aria-hidden="true"
      >
        {formatTime(safeMax)}
      </span>
    </div>
  );
}
