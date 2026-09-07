import type { Song } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../supabase';
import { createLocalBackend } from './localBackend';
import { createSupabaseBackend } from './supabaseBackend';
import type { JukeboxBackend } from './types';

import bundledSongs from '../../data/songs.json';

/** The library that ships with the repo; also the seed for supabase/seed.sql. */
export const BUNDLED_SONGS = bundledSongs as Song[];

/**
 * Supabase when it's configured, otherwise a cross-tab local fallback so the
 * app is never a dead page. `backend.mode` is surfaced in the UI so nobody is
 * misled about whether the queue is really shared across devices.
 */
export const backend: JukeboxBackend =
  isSupabaseConfigured && supabase
    ? createSupabaseBackend(supabase)
    : createLocalBackend(BUNDLED_SONGS);

export type { JukeboxBackend };
export { JukeboxError } from './types';
