import React, { useRef, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react';

/**
 * Adapted from React Bits (reactbits.dev) — "Elastic Slider".
 *
 * Changes made for Saloon Jukebox:
 *  - controlled `value` + `onChange` so it can actually drive the volume
 *  - full keyboard support and ARIA slider semantics (the original was
 *    pointer-only, which made volume unreachable without a mouse)
 *  - themeable track/fill colours instead of hard-coded grays
 */

const MAX_OVERFLOW = 50;

interface ElasticSliderProps {
  value: number;
  onChange: (value: number) => void;
  startingValue?: number;
  maxValue?: number;
  className?: string;
  isStepped?: boolean;
  stepSize?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ariaLabel?: string;
  /** Formats the value for screen readers, e.g. `80%`. */
  formatValue?: (value: number) => string;
  trackClassName?: string;
  fillClassName?: string;
}

const ElasticSlider: React.FC<ElasticSliderProps> = ({
  value,
  onChange,
  startingValue = 0,
  maxValue = 100,
  className = '',
  isStepped = false,
  stepSize = 1,
  leftIcon = <>-</>,
  rightIcon = <>+</>,
  ariaLabel = 'Slider',
  formatValue,
  trackClassName = 'bg-white/15',
  fillClassName = 'bg-white',
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<'left' | 'middle' | 'right'>('middle');
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);

  useMotionValueEvent(clientX, 'change', (latest: number) => {
    if (!sliderRef.current) return;
    const { left, right } = sliderRef.current.getBoundingClientRect();
    let next: number;
    if (latest < left) {
      setRegion('left');
      next = left - latest;
    } else if (latest > right) {
      setRegion('right');
      next = latest - right;
    } else {
      setRegion('middle');
      next = 0;
    }
    overflow.jump(decay(next, MAX_OVERFLOW));
  });

  const clamp = (v: number) => Math.min(Math.max(v, startingValue), maxValue);

  const commit = (raw: number) => {
    const stepped = isStepped ? Math.round(raw / stepSize) * stepSize : raw;
    const next = clamp(stepped);
    if (next !== value) onChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      commit(startingValue + ((e.clientX - left) / width) * (maxValue - startingValue));
      clientX.jump(e.clientX);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    animate(overflow, 0, { type: 'spring', bounce: 0.5 });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const range = maxValue - startingValue;
    const small = isStepped ? stepSize : range / 20;
    const large = isStepped ? stepSize * 5 : range / 5;
    let next: number | null = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + small;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - small;
    else if (e.key === 'PageUp') next = value + large;
    else if (e.key === 'PageDown') next = value - large;
    else if (e.key === 'Home') next = startingValue;
    else if (e.key === 'End') next = maxValue;

    if (next !== null) {
      e.preventDefault();
      commit(next);
    }
  };

  const percentage = (() => {
    const total = maxValue - startingValue;
    return total === 0 ? 0 : ((clamp(value) - startingValue) / total) * 100;
  })();

  // `useTransform` must run unconditionally, so these are hoisted out of JSX.
  const groupOpacity = useTransform(scale, [1, 1.2], [0.75, 1]);
  const leftX = useTransform(() => (region === 'left' ? -overflow.get() / scale.get() : 0));
  const rightX = useTransform(() => (region === 'right' ? overflow.get() / scale.get() : 0));
  const barScaleX = useTransform(() => {
    if (!sliderRef.current) return 1;
    const { width } = sliderRef.current.getBoundingClientRect();
    return 1 + overflow.get() / width;
  });
  const barScaleY = useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]);
  const barOrigin = useTransform(() => {
    if (!sliderRef.current) return 'center';
    const { left, width } = sliderRef.current.getBoundingClientRect();
    return clientX.get() < left + width / 2 ? 'right' : 'left';
  });
  const barHeight = useTransform(scale, [1, 1.2], [6, 11]);
  const barMarginY = useTransform(scale, [1, 1.2], [0, -2.5]);

  return (
    <motion.div
      onHoverStart={() => animate(scale, 1.2)}
      onHoverEnd={() => animate(scale, 1)}
      onTouchStart={() => animate(scale, 1.2)}
      onTouchEnd={() => animate(scale, 1)}
      style={{ scale, opacity: groupOpacity }}
      className={`flex touch-none items-center justify-center gap-2 select-none ${className}`}
    >
      <motion.div
        animate={{ scale: region === 'left' ? [1, 1.4, 1] : 1, transition: { duration: 0.25 } }}
        style={{ x: leftX }}
        className="flex shrink-0 items-center"
      >
        {leftIcon}
      </motion.div>

      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={startingValue}
        aria-valuemax={maxValue}
        aria-valuenow={Math.round(clamp(value))}
        aria-valuetext={formatValue?.(clamp(value))}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        className="relative flex w-full grow cursor-grab touch-none items-center rounded-full py-3 select-none active:cursor-grabbing"
      >
        <motion.div
          style={{
            scaleX: barScaleX,
            scaleY: barScaleY,
            transformOrigin: barOrigin,
            height: barHeight,
            marginTop: barMarginY,
            marginBottom: barMarginY,
          }}
          className="flex grow"
        >
          <div className={`relative h-full grow overflow-hidden rounded-full ${trackClassName}`}>
            <div
              className={`absolute h-full rounded-full ${fillClassName}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </motion.div>
      </div>

      <motion.div
        animate={{ scale: region === 'right' ? [1, 1.4, 1] : 1, transition: { duration: 0.25 } }}
        style={{ x: rightX }}
        className="flex shrink-0 items-center"
      >
        {rightIcon}
      </motion.div>
    </motion.div>
  );
};

function decay(value: number, max: number): number {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}

export default ElasticSlider;
