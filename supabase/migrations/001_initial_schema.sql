-- =====================================================================
-- Saloon Jukebox — initial schema
--
-- Run this once in the Supabase SQL editor (or `supabase db push`), then
-- run supabase/seed.sql to stock the record shelf.
--
-- Design notes
-- ------------
-- * `playback` is a single row. It is the authority on what is playing and
--   where the needle is, so every browser derives its playhead from it rather
--   than keeping its own. That is what keeps clients in sync.
-- * Clients never write to these tables directly. Every mutation is a
--   SECURITY DEFINER function that takes a row lock on `playback` first, which
--   serialises concurrent callers and makes queue advancement race-free.
-- * `jukebox_advance` takes the caller's *expected* current entry. If someone
--   else already moved the queue on, the call becomes a no-op instead of
--   skipping an extra song. Twenty phones can fire `ended` at once safely.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null,
  artist     text        not null,
  album      text,
  genre      text,
  duration   integer,                       -- seconds
  audio_url  text        not null,          -- relative path or absolute URL
  cover_url  text,
  created_at timestamptz not null default now()
);

-- Idempotent: `create type` has no IF NOT EXISTS.
do $$
begin
  create type public.queue_status as enum ('queued', 'playing', 'played');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.queue (
  id        uuid primary key default gen_random_uuid(),
  song_id   uuid not null references public.songs (id) on delete cascade,
  added_at  timestamptz not null default now(),
  -- Explicit ordering key. Ties break on added_at then id, so order is total
  -- and identical for every client.
  position  bigint not null,
  status    public.queue_status not null default 'queued',
  added_by  text
);

-- The single shared transport. There is exactly one row, id = 1.
create table if not exists public.playback (
  id                  smallint primary key default 1,
  current_queue_id    uuid references public.queue (id) on delete set null,
  is_playing          boolean     not null default false,
  -- Playhead as of `position_updated_at`. Clients extrapolate:
  --   expected = position_seconds + (is_playing ? now() - position_updated_at : 0)
  position_seconds    numeric     not null default 0,
  position_updated_at timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint playback_singleton check (id = 1)
);

create table if not exists public.requests (
  id           uuid primary key default gen_random_uuid(),
  message      text not null check (char_length(message) between 1 and 280),
  requested_by text check (char_length(requested_by) <= 40),
  created_at   timestamptz not null default now()
);

insert into public.playback (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------

create index if not exists queue_play_order_idx on public.queue (status, position, added_at, id);
create index if not exists queue_position_idx   on public.queue (position);
create index if not exists requests_recent_idx  on public.requests (created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Reads are public (this is a jukebox in a bar). Writes are closed: the
-- functions below run as owner and are the only way in. The anon key in the
-- browser therefore cannot corrupt the queue even if someone crafts requests
-- by hand. The service-role key is never needed client-side.
-- ---------------------------------------------------------------------

alter table public.songs    enable row level security;
alter table public.queue    enable row level security;
alter table public.playback enable row level security;
alter table public.requests enable row level security;

drop policy if exists "songs are public"    on public.songs;
drop policy if exists "queue is public"     on public.queue;
drop policy if exists "playback is public"  on public.playback;
drop policy if exists "requests are public" on public.requests;
drop policy if exists "anyone can request"  on public.requests;

create policy "songs are public"    on public.songs    for select using (true);
create policy "queue is public"     on public.queue    for select using (true);
create policy "playback is public"  on public.playback for select using (true);
create policy "requests are public" on public.requests for select using (true);

-- The request wall is the one place a client writes directly; the column
-- constraints above bound what it can say.
create policy "anyone can request" on public.requests for insert with check (true);

-- ---------------------------------------------------------------------
-- Read model
-- ---------------------------------------------------------------------

-- One consistent snapshot: the transport, the queue (with songs joined), and
-- the server clock so clients can correct their own skew.
create or replace function public.jukebox_state()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'playback', (select to_jsonb(p) from public.playback p where p.id = 1),
    'queue', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id',       q.id,
                 'song_id',  q.song_id,
                 'added_at', q.added_at,
                 'position', q.position,
                 'status',   q.status,
                 'added_by', q.added_by,
                 'song',     to_jsonb(s)
               )
               order by q.position, q.added_at, q.id
             )
      from (
        -- Everything still live, plus a little history for the "recently
        -- played" list. Older rows stay in the table but off the wire.
        select * from public.queue where status <> 'played'
        union all
        select * from (
          select * from public.queue where status = 'played'
          order by position desc limit 20
        ) recent
      ) q
      join public.songs s on s.id = q.song_id
    ), '[]'::jsonb),
    'server_time', now()
  );
$$;

-- ---------------------------------------------------------------------
-- Mutations
-- ---------------------------------------------------------------------

-- Trim ancient history so the table doesn't grow without bound.
create or replace function public.jukebox_prune()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.queue
   where status = 'played'
     and id not in (
       select id from public.queue where status = 'played'
       order by position desc limit 50
     );
$$;

-- Append a song. Starts it immediately if the jukebox is idle, so the first
-- coin in the slot just works.
create or replace function public.jukebox_add_to_queue(
  p_song_id  uuid,
  p_added_by text default 'Guest'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current        uuid;
  v_current_status public.queue_status;
  v_new_id         uuid;
  v_position       bigint;
begin
  if not exists (select 1 from public.songs where id = p_song_id) then
    raise exception 'No such song: %', p_song_id using errcode = 'no_data_found';
  end if;

  -- Take the transport lock first: it orders this insert against any
  -- concurrent advance, so `position` can't collide.
  select current_queue_id into v_current from public.playback where id = 1 for update;

  select coalesce(max(position), 0) + 1 into v_position from public.queue;

  insert into public.queue (song_id, position, status, added_by)
  values (
    p_song_id,
    v_position,
    'queued',
    coalesce(nullif(btrim(p_added_by), ''), 'Guest')
  )
  returning id into v_new_id;

  select status into v_current_status from public.queue where id = v_current;

  -- Nothing playing (fresh jukebox, or the queue ran dry): start this one.
  if v_current is null or v_current_status is distinct from 'playing' then
    update public.queue set status = 'playing' where id = v_new_id;
    update public.playback
       set current_queue_id    = v_new_id,
           is_playing          = true,
           position_seconds    = 0,
           position_updated_at = now(),
           updated_at          = now()
     where id = 1;
  end if;

  return public.jukebox_state();
end;
$$;

-- Pull a record that hasn't started yet. Already-playing entries are left be.
create or replace function public.jukebox_remove_from_queue(p_queue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.playback where id = 1 for update;
  delete from public.queue where id = p_queue_id and status = 'queued';
  return public.jukebox_state();
end;
$$;

-- Move to the next track.
--
-- `p_expected_current_id` is the entry the caller believes is playing. If that
-- no longer matches, another client already advanced and this call does
-- nothing. This is the whole answer to "every browser fires `ended` at once".
create or replace function public.jukebox_advance(p_expected_current_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
  v_next_id uuid;
begin
  -- Serialises concurrent callers on one row.
  select current_queue_id into v_current from public.playback where id = 1 for update;

  if v_current is distinct from p_expected_current_id then
    return public.jukebox_state();          -- someone beat us to it
  end if;

  if v_current is not null then
    update public.queue set status = 'played' where id = v_current;
  end if;

  select id into v_next_id
    from public.queue
   where status = 'queued'
   order by position, added_at, id
   limit 1;

  if v_next_id is not null then
    update public.queue set status = 'playing' where id = v_next_id;
    update public.playback
       set current_queue_id    = v_next_id,
           is_playing          = true,
           position_seconds    = 0,
           position_updated_at = now(),
           updated_at          = now()
     where id = 1;
  else
    -- Queue ran dry: fall silent rather than looping.
    update public.playback
       set current_queue_id    = null,
           is_playing          = false,
           position_seconds    = 0,
           position_updated_at = now(),
           updated_at          = now()
     where id = 1;
  end if;

  perform public.jukebox_prune();
  return public.jukebox_state();
end;
$$;

-- Shared pause/resume. `p_position_seconds` is where the caller's needle is.
create or replace function public.jukebox_set_playing(
  p_is_playing       boolean,
  p_position_seconds numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.playback where id = 1 for update;
  update public.playback
     set is_playing          = p_is_playing,
         position_seconds    = greatest(0, coalesce(p_position_seconds, 0)),
         position_updated_at = now(),
         updated_at          = now()
   where id = 1;
  return public.jukebox_state();
end;
$$;

-- Shared seek: everyone's needle moves together.
create or replace function public.jukebox_seek(p_position_seconds numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.playback where id = 1 for update;
  update public.playback
     set position_seconds    = greatest(0, coalesce(p_position_seconds, 0)),
         position_updated_at = now(),
         updated_at          = now()
   where id = 1;
  return public.jukebox_state();
end;
$$;

-- ---------------------------------------------------------------------
-- Grants — anonymous visitors get exactly these verbs and nothing else.
-- ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.songs, public.queue, public.playback, public.requests to anon, authenticated;
grant insert on public.requests to anon, authenticated;

grant execute on function public.jukebox_state()                        to anon, authenticated;
grant execute on function public.jukebox_add_to_queue(uuid, text)       to anon, authenticated;
grant execute on function public.jukebox_remove_from_queue(uuid)        to anon, authenticated;
grant execute on function public.jukebox_advance(uuid)                  to anon, authenticated;
grant execute on function public.jukebox_set_playing(boolean, numeric)  to anon, authenticated;
grant execute on function public.jukebox_seek(numeric)                  to anon, authenticated;

-- Internal helper: not reachable from the browser.
revoke execute on function public.jukebox_prune() from anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime — clients subscribe to these tables to learn that something
-- changed, then re-read jukebox_state() for the authoritative snapshot.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue'
  ) then
    alter publication supabase_realtime add table public.queue;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playback'
  ) then
    alter publication supabase_realtime add table public.playback;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
end
$$;
