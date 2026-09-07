-- =====================================================================
-- Saloon Jukebox — a working "previous track"
--
-- The first cut faked this client-side by re-adding the last played song via
-- jukebox_add_to_queue. That appends to the *end* of the queue, so the
-- following advance() picked the next waiting record instead — "previous"
-- behaved exactly like "skip", and quietly duplicated a row each press.
--
-- Going back is really a queue reordering, so it belongs in one atomic
-- function like every other mutation.
-- =====================================================================

create or replace function public.jukebox_previous()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
  v_prev_id uuid;
  v_front   bigint;
begin
  -- Same lock as every other mutation, so this orders correctly against a
  -- concurrent advance or add.
  select current_queue_id into v_current from public.playback where id = 1 for update;

  select id into v_prev_id
    from public.queue
   where status = 'played'
   order by position desc, added_at desc, id desc
   limit 1;

  -- Nothing behind us: treat it as "start this one again".
  if v_prev_id is null then
    update public.playback
       set position_seconds    = 0,
           position_updated_at = now(),
           updated_at          = now()
     where id = 1;
    return public.jukebox_state();
  end if;

  select coalesce(min(position), 0) into v_front from public.queue where status = 'queued';

  -- Put the record we're leaving back at the head of the queue, so going back
  -- doesn't throw it away — it simply plays again next.
  if v_current is not null then
    update public.queue
       set status = 'queued', position = v_front - 1
     where id = v_current;
  end if;

  update public.queue
     set status = 'playing', position = v_front - 2
   where id = v_prev_id;

  update public.playback
     set current_queue_id    = v_prev_id,
         is_playing          = true,
         position_seconds    = 0,
         position_updated_at = now(),
         updated_at          = now()
   where id = 1;

  return public.jukebox_state();
end;
$$;

grant execute on function public.jukebox_previous() to anon, authenticated;
