/** Audio/URL helpers shared by the player and the library UI. */

/**
 * Songs store *relative* paths (`music/foo.mp3`) so the same database works on
 * a domain root and on a project-scoped host like GitHub Pages. Absolute URLs
 * are passed straight through, so you can point a row at external storage.
 */
export function resolveAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/** `195` -> `3:15`. Handles NaN/Infinity from a not-yet-loaded <audio>. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Longer form used for "total time in the queue". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} hr ${mins % 60} min`;
}

/** Turn a MediaError into something a person in a bar would understand. */
export function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'That record was taken off the turntable.';
    case MediaError.MEDIA_ERR_NETWORK:
      return "Lost the wire while loading this one. Check your connection, or skip ahead.";
    case MediaError.MEDIA_ERR_DECODE:
      return "This record is scratched — the audio wouldn't decode.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "Couldn't load this track — the file is missing or this browser can't play it.";
    default:
      return "Couldn't play this track. Try skipping to the next song.";
  }
}
