import { useEffect, useRef, useState } from 'react';

import SplitFlapText from './reactbits/SplitFlapText';

interface FlapBoardProps {
  text: string;
  /** Upper bound on tile type size; the board shrinks below this to fit. */
  maxFontSize?: number;
  className?: string;
}

/**
 * React Bits' split-flap display, sized to fit its container.
 *
 * The raw component takes a fixed `fontSize`, which overflows the moment a song
 * title is long. This measures the available width and derives a size that
 * always fits, so "Barroom Ballet" and "Whiskey on the Mississippi" both land
 * cleanly on any screen.
 */
export function FlapBoard({ text, maxFontSize = 34, className = '' }: FlapBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const label = text.toUpperCase().slice(0, 30);
  const chars = Math.max(label.length, 1);
  const gap = 3;
  // Each tile is ~0.74em wide plus the gap; solve for the size that fits.
  const fontSize = width
    ? Math.max(9, Math.min(maxFontSize, Math.floor((width - gap * (chars - 1)) / (chars * 0.78))))
    : 0;

  return (
    <div ref={hostRef} className={`w-full ${className}`}>
      {fontSize > 0 && (
        <SplitFlapText
          key={chars}
          text={label}
          padTo={chars}
          fontSize={fontSize}
          gap={gap}
          tileColor="#1a130d"
          textColor="#f6dda6"
          tileRadius={4}
          flipDuration={0.11}
          stagger={0.035}
          flipsPerChar={5}
          loop={false}
          charset="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
