import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageSquareQuote, Send } from 'lucide-react';

import type { RequestRow } from '../types/database';

interface RequestLineProps {
  requests: RequestRow[];
  onSubmit: (message: string) => Promise<void>;
}

const MAX = 280;

/**
 * The wall by the bar where people pin notes. Deliberately dumb: it records a
 * wish, it doesn't try to find music. Whoever stocks the library reads it.
 */
export function RequestLine({ requests, onSubmit }: RequestLineProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSubmit(text);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="request-heading" className="saloon-panel p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <MessageSquareQuote className="text-brass-400 size-4 shrink-0" aria-hidden="true" />
        <h2 id="request-heading" className="saloon-heading">
          Request Line
        </h2>
      </div>
      <p className="text-parchment-400/80 mb-3 text-[11px]">
        Can't find it on the shelf? Leave a note for the barkeep.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="request-input" className="sr-only">
            What should we play next?
          </label>
          <input
            id="request-input"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
            placeholder="What should we play next?"
            maxLength={MAX}
            className="border-brass-600/25 bg-wood-900/70 text-parchment-100 placeholder:text-parchment-400/70 focus:border-brass-500/60 w-full rounded-full border px-4 py-2.5 text-sm transition-colors outline-none"
          />
          {message.length > MAX - 60 && (
            <span className="text-parchment-400 absolute -top-5 right-1 text-[10px] tabular-nums">
              {MAX - message.length}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!message.trim() || sending}
          aria-label="Send request"
          className="border-brass-500/45 bg-brass-500/15 text-brass-300 hover:bg-brass-500/30 grid size-11 shrink-0 place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </form>

      {requests.length > 0 && (
        <ul className="scrollbar-saloon mt-4 max-h-44 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {requests.slice(0, 12).map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border-brass-600/20 bg-wood-900/40 rounded-lg border px-3 py-2"
              >
                <p className="text-parchment-200 text-sm leading-snug break-words">“{r.message}”</p>
                <p className="text-brass-400/70 mt-1 text-[10px] tracking-wide uppercase">
                  — {r.requested_by || 'Guest'}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
