import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'neutral',
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-12'}`}
    >
      <div
        className={`mb-3 grid place-items-center rounded-full border p-3.5 ${
          tone === 'error'
            ? 'border-oxblood-400/40 bg-oxblood-600/15 text-oxblood-400'
            : 'border-brass-600/30 bg-wood-800/60 text-brass-400/80'
        }`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <p className="font-sign text-parchment-200 text-sm font-semibold tracking-[0.16em] uppercase">
        {title}
      </p>
      {body && <p className="text-parchment-400 mt-2 max-w-xs text-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
