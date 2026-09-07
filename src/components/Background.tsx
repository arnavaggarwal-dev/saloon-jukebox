import { useEffect, useState } from 'react';

import Noise from './reactbits/Noise';
import Topography from './reactbits/Topography';

/**
 * Ambient saloon backdrop: React Bits' Topography shader tinted to warm wood
 * grain, plus a film-grain overlay for a printed-paper feel.
 *
 * The shader is skipped on small screens and when the user asks for reduced
 * motion — a full-screen WebGL loop isn't worth the battery on a phone, and the
 * static gradient underneath already carries the theme.
 */
export function Background() {
  const [rich, setRich] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setRich(wide.matches && !calm.matches);
    update();
    wide.addEventListener('change', update);
    calm.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      calm.removeEventListener('change', update);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {rich && (
        <div className="absolute inset-0 opacity-[0.38]">
          <Topography
            lowColor="#1a120b"
            midColor="#8a5a24"
            highColor="#e0a94f"
            speed={0.12}
            morphAmount={2.2}
            morphSpeed={0.02}
            bands={2.6}
            thickness={0.008}
            scale={1.35}
            glow={0.35}
            contrast={2.2}
            brightness={0.85}
            grain={false}
            mouseInteraction={false}
            pixelSize={1.5}
          />
        </div>
      )}
      {/* Keep the room dark at the edges so foreground panels stay readable. */}
      <div className="from-wood-950/10 via-wood-950/55 to-wood-950 absolute inset-0 bg-gradient-to-b" />
      <div className="absolute inset-0 opacity-[0.5] mix-blend-soft-light">
        <Noise patternAlpha={11} patternRefreshInterval={4} />
      </div>
    </div>
  );
}
