import { Disc3, MonitorSmartphone, Radio, WifiOff } from 'lucide-react';

import ShinyText from './reactbits/ShinyText';
import type { ConnectionStatus } from '../types/database';

const STATUS: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string; icon: typeof Radio; title: string }
> = {
  connecting: {
    label: 'Connecting',
    dot: 'bg-brass-400/70',
    text: 'text-brass-300',
    icon: Radio,
    title: 'Connecting to the shared queue…',
  },
  live: {
    label: 'Live',
    dot: 'bg-sage-400',
    text: 'text-sage-400',
    icon: Radio,
    title: 'Connected — the queue updates in realtime',
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-brass-400',
    text: 'text-brass-300',
    icon: Radio,
    title: 'Connection dropped — retrying, the app stays usable',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-oxblood-400',
    text: 'text-oxblood-400',
    icon: WifiOff,
    title: "Can't reach the queue right now",
  },
};

interface HeaderProps {
  status: ConnectionStatus;
  mode: 'supabase' | 'local';
  guestName: string;
  /** How many records are waiting behind the current one. */
  queueCount: number;
}

export function Header({ status, mode, guestName, queueCount }: HeaderProps) {
  const s = STATUS[status];
  const Icon = s.icon;

  return (
    <header className="border-brass-600/20 bg-wood-950/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
        <Disc3
          className="text-brass-400 size-7 shrink-0 sm:size-8"
          style={{ animation: 'spin-record 8s linear infinite' }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-lg leading-none sm:text-2xl">
            <ShinyText
              text="Saloon Jukebox"
              color="#e0a94f"
              shineColor="#fff3d6"
              speed={4}
              spread={90}
            />
          </h1>
          <p className="text-parchment-400 mt-1 hidden text-[11px] tracking-[0.18em] uppercase sm:block">
            Drop a coin · pick a record · everybody listens
          </p>
        </div>

        {/* Local mode must be obvious: the queue is not shared across devices. */}
        {mode === 'local' && (
          <span
            title="No Supabase configured — the queue is shared between tabs in this browser only."
            className="border-brass-600/40 bg-wood-800/70 text-brass-300 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase sm:inline-flex"
          >
            <MonitorSmartphone className="size-3" aria-hidden="true" />
            This browser only
          </span>
        )}

        {queueCount > 0 && (
          <span className="text-parchment-400 hidden text-xs tracking-wide sm:inline">
            {queueCount} waiting
          </span>
        )}

        <div
          className="border-brass-600/30 bg-wood-800/70 flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5"
          title={s.title}
        >
          <span
            className={`size-2 rounded-full ${s.dot}`}
            style={status === 'live' ? { animation: 'pulse-live 2.4s ease-out infinite' } : undefined}
            aria-hidden="true"
          />
          <Icon className={`size-3.5 ${s.text}`} aria-hidden="true" />
          <span className={`text-[10px] font-semibold tracking-[0.16em] uppercase ${s.text}`}>
            {s.label}
          </span>
          {/* Announce connection changes without stealing focus. */}
          <span className="sr-only" role="status" aria-live="polite">
            {s.title}
          </span>
        </div>

        <span
          className="border-brass-600/25 bg-wood-800/60 text-parchment-300 hidden shrink-0 rounded-full border px-3 py-1.5 text-xs sm:inline"
          title="Your anonymous handle for this browser. No account, no personal data."
        >
          {guestName}
        </span>
      </div>
    </header>
  );
}
