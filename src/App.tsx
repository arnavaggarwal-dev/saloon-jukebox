import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { Background } from './components/Background';
import { Header } from './components/Header';
import { JoinOverlay } from './components/JoinOverlay';
import { MusicLibrary } from './components/MusicLibrary';
import { NowPlaying } from './components/NowPlaying';
import { PlayerBar } from './components/PlayerBar';
import { Queue } from './components/Queue';
import { RequestLine } from './components/RequestLine';
import { ToastViewport } from './components/Toast';
import ClickSpark from './components/reactbits/ClickSpark';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useJukebox } from './hooks/useJukebox';
import { ToastProvider, useToast } from './hooks/useToast';

function Jukebox() {
  const { push } = useToast();

  const handleError = useCallback((message: string) => push(message, 'error'), [push]);
  const jukebox = useJukebox(handleError);
  const player = useAudioPlayer(jukebox);

  const {
    songs,
    queue,
    upNext,
    history,
    currentEntry,
    playback,
    requests,
    status,
    guestName,
    mode,
    loadingLibrary,
    loadingQueue,
    libraryError,
    addToQueue,
    removeFromQueue,
    skip,
    previous,
    addRequest,
  } = jukebox;

  const handleAdd = useCallback(
    async (songId: string) => {
      const song = songs.find((s) => s.id === songId);
      await addToQueue(songId);
      push(song ? `Added “${song.title}” to the queue` : 'Added to the queue', 'success');
    },
    [addToQueue, songs, push],
  );

  const handleSkip = useCallback(async () => {
    if (!currentEntry) return;
    push('Skipping…', 'info');
    await skip();
  }, [currentEntry, skip, push]);

  const handleRemove = useCallback(
    async (queueId: string) => {
      await removeFromQueue(queueId);
      push('Pulled that record from the queue', 'info');
    },
    [removeFromQueue, push],
  );

  // Keyboard transport, skipped while the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

      if (e.code === 'Space') {
        e.preventDefault();
        void player.togglePlay();
      } else if (e.code === 'KeyN' || (e.code === 'ArrowRight' && e.shiftKey)) {
        e.preventDefault();
        void handleSkip();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        player.toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, handleSkip]);

  // Let the OS/lock-screen media keys drive the shared transport too.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const song = currentEntry?.song;
    navigator.mediaSession.metadata = song
      ? new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: song.album ?? 'Saloon Jukebox',
        })
      : null;
    navigator.mediaSession.playbackState = playback.is_playing ? 'playing' : 'paused';

    const safe = (fn: () => void) => () => fn();
    navigator.mediaSession.setActionHandler('play', safe(() => void player.togglePlay()));
    navigator.mediaSession.setActionHandler('pause', safe(() => void player.togglePlay()));
    navigator.mediaSession.setActionHandler('nexttrack', safe(() => void handleSkip()));
    navigator.mediaSession.setActionHandler('previoustrack', safe(() => void previous()));
  }, [currentEntry, playback.is_playing, player, handleSkip, previous]);

  // The entry overlay is atmospheric, but it must never be a wall: dismissing
  // it leaves the library and queue fully usable, just silent on this device.
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const wantsGesture = !player.hasJoined || player.needsGesture;

  // If the browser cuts audio off mid-session, ask again even if they'd
  // previously waved the overlay away.
  useEffect(() => {
    if (player.needsGesture) setOverlayDismissed(false);
  }, [player.needsGesture]);

  const showJoin = wantsGesture && !overlayDismissed;

  return (
    <ClickSpark sparkColor="#e0a94f" sparkCount={9} sparkRadius={19} sparkSize={9} duration={480}>
      {/* Which backend is live. Surfaced for tests and for debugging a
          deployment where the credentials didn't make it into the build. */}
      <div className="flex min-h-dvh flex-col" data-backend={mode}>
        <Background />

        <Header
          status={status}
          mode={mode}
          guestName={guestName}
          queueCount={upNext.length}
        />

        {/* pb leaves room for the fixed player bar. */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pt-4 pb-40 sm:px-6 sm:pb-32">
          <NowPlaying
            entry={currentEntry}
            isPlaying={playback.is_playing}
            currentTime={player.currentTime}
            duration={player.duration}
            loadState={player.loadState}
            audioError={player.audioError}
            upNextTitle={upNext[0]?.song.title ?? null}
            onSkip={handleSkip}
          />

          {/*
            Desktop: library left, queue right.
            Mobile: queue first (order-1) so what's coming up is visible without
            scrolling past the whole shelf.
          */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
            <div className="order-2 min-w-0 lg:order-1">
              <MusicLibrary
                songs={songs}
                queue={queue}
                currentSongId={currentEntry?.song.id ?? null}
                loading={loadingLibrary}
                error={libraryError}
                onAdd={handleAdd}
              />
            </div>

            <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
              <Queue
                upNext={upNext}
                history={history}
                loading={loadingQueue}
                onRemove={handleRemove}
              />
              <RequestLine requests={requests} onSubmit={addRequest} />
            </div>
          </div>

          <footer className="text-parchment-400/60 mt-8 text-center text-[11px] leading-relaxed">
            <p>
              Saloon Jukebox · the queue is shared, the volume is yours ·{' '}
              <a
                href="https://github.com/arnavaggarwal-dev/saloon-jukebox"
                target="_blank"
                rel="noreferrer noopener"
                className="text-brass-400/80 hover:text-brass-300 underline underline-offset-2"
              >
                source on GitHub
              </a>
            </p>
          </footer>
        </main>

        <PlayerBar
          player={player}
          entry={currentEntry}
          isPlaying={playback.is_playing}
          canSkip={Boolean(currentEntry)}
          onSkip={handleSkip}
          onPrevious={previous}
        />

        {/*
          THE single audio element for the whole app. Everything else is UI on
          top of this one tag.
        */}
        <audio ref={player.audioRef} preload="auto" crossOrigin="anonymous" />

        <AnimatePresence>
          {showJoin && (
            <JoinOverlay
              onJoin={() => void player.join()}
              onDismiss={() => setOverlayDismissed(true)}
              interrupted={player.needsGesture && player.hasJoined}
              nowPlayingTitle={currentEntry?.song.title ?? null}
            />
          )}
        </AnimatePresence>

        <ToastViewport />
      </div>
    </ClickSpark>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Jukebox />
    </ToastProvider>
  );
}
