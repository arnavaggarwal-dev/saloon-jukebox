import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

import { useToast, type ToastTone } from '../hooks/useToast';

const TONE_STYLES: Record<ToastTone, { ring: string; icon: typeof Info; iconClass: string }> = {
  success: { ring: 'border-sage-400/45', icon: CheckCircle2, iconClass: 'text-sage-400' },
  error: { ring: 'border-oxblood-400/60', icon: TriangleAlert, iconClass: 'text-oxblood-400' },
  info: { ring: 'border-brass-500/45', icon: Info, iconClass: 'text-brass-300' },
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      // Errors need to interrupt; successes shouldn't talk over the user.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-70 flex flex-col items-center gap-2 px-4 sm:bottom-32"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const { ring, icon: Icon, iconClass } = TONE_STYLES[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={`bg-wood-800/95 pointer-events-auto flex max-w-md items-start gap-2.5 rounded-full border py-2.5 pr-2.5 pl-4 shadow-[0_12px_34px_-10px_rgb(0_0_0/0.9)] backdrop-blur ${ring}`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden="true" />
              <p className="text-parchment-100 text-sm leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="text-parchment-400 hover:text-parchment-100 hover:bg-wood-600/70 -mt-0.5 rounded-full p-1 transition"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
