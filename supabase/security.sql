-- Apply in the Supabase SQL Editor before deploying the updated app and upload-avatar function.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_insert_via_upload_function on storage.objects;
create policy avatars_insert_via_upload_function
on storage.objects
as restrictive
for insert
to public
with check (
  bucket_id <> 'avatars'
  or (select auth.role()) = 'service_role'
);

drop policy if exists avatars_update_via_upload_function on storage.objects;
create policy avatars_update_via_upload_function
on storage.objects
as restrictive
for update
to public
using (
  bucket_id <> 'avatars'
  or (select auth.role()) = 'service_role'
)
with check (
  bucket_id <> 'avatars'
  or (select auth.role()) = 'service_role'
);

drop policy if exists avatars_delete_via_upload_function on storage.objects;
create policy avatars_delete_via_upload_function
on storage.objects
as restrictive
for delete
to public
using (
  bucket_id <> 'avatars'
  or (select auth.role()) = 'service_role'
);

alter table public.users enable row level security;
alter table public.user_sessions enable row level security;
revoke all on table public.users, public.user_sessions from public, anon, authenticated;

create or replace function public.cone_clash_register_user(
  p_username text,
  p_password text
)
returns table (username character varying)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := pg_catalog.lower(pg_catalog.btrim(p_username));
  v_user_id uuid;
begin
  if v_username is null
    or pg_catalog.char_length(v_username) < 3
    or pg_catalog.char_length(v_username) > 50
    or p_password is null
    or pg_catalog.char_length(p_password) < 6
    or pg_catalog.octet_length(p_password) > 72
  then
    raise exception 'Invalid username or password.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_username, 0)
  );

  if exists (
    select 1
    from public.users as u
    where pg_catalog.lower(u.username) = v_username
  ) then
    raise exception 'Username already taken.';
  end if;

  insert into public.users (
    id,
    username,
    password_hash,
    role,
    account_status
  )
  values (
    pg_catalog.gen_random_uuid(),
    v_username,
    extensions.crypt(p_password, extensions.gen_salt('bf', 12)),
    'user',
    'active'
  )
  returning id into v_user_id;

  return query
    select u.username
    from public.users as u
    where u.id = v_user_id;
exception
  when unique_violation then
    raise exception 'Username already taken.';
end;
$function$;

create or replace function public.cone_clash_login_user(
  p_username text,
  p_password text
)
returns table (
  session_token uuid,
  user_id uuid,
  username character varying,
  role character varying
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := pg_catalog.lower(pg_catalog.btrim(p_username));
  v_user_id uuid;
  v_password_hash text;
  v_stored_username character varying;
  v_role character varying;
  v_account_status character varying;
  v_session_token uuid;
begin
  if v_username is null
    or pg_catalog.char_length(v_username) < 3
    or pg_catalog.char_length(v_username) > 50
    or p_password is null
    or pg_catalog.octet_length(p_password) > 72
  then
    raise exception 'Wrong username or password.';
  end if;

  select u.id, u.password_hash, u.username, u.role, u.account_status
  into v_user_id, v_password_hash, v_stored_username, v_role, v_account_status
  from public.users as u
  where pg_catalog.lower(u.username) = v_username
  for update;

  if not found or v_password_hash is null then
    raise exception 'Wrong username or password.';
  end if;

  if extensions.crypt(p_password, v_password_hash) is distinct from v_password_hash then
    raise exception 'Wrong username or password.';
  end if;

  if v_account_status is distinct from 'active' then
    raise exception 'Account disabled.';
  end if;

  v_session_token := pg_catalog.gen_random_uuid();

  insert into public.user_sessions (
    token,
    user_id,
    created_at,
    expires_at
  )
  values (
    v_session_token,
    v_user_id,
    pg_catalog.now(),
    pg_catalog.now() + interval '7 days'
  );

  update public.users as u
  set last_activity = pg_catalog.now()
  where u.id = v_user_id;

  return query
    select v_session_token, v_user_id, v_stored_username, v_role;
end;
$function$;

create or replace function public.cone_clash_get_session(
  p_session_token uuid
)
returns table (
  user_id uuid,
  username character varying,
  role character varying
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
    select u.id, u.username, u.role
    from public.user_sessions as s
    join public.users as u on u.id = s.user_id
    where s.token = p_session_token
      and s.expires_at > pg_catalog.now()
      and u.account_status = 'active';
end;
$function$;

create or replace function public.cone_clash_logout_user(
  p_session_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.user_sessions as s
  where s.token = p_session_token;
end;
$function$;

revoke all on function public.cone_clash_register_user(text, text) from public;
revoke all on function public.cone_clash_login_user(text, text) from public;
revoke all on function public.cone_clash_get_session(uuid) from public;
revoke all on function public.cone_clash_logout_user(uuid) from public;
grant execute on function public.cone_clash_register_user(text, text) to anon, authenticated;
grant execute on function public.cone_clash_login_user(text, text) to anon, authenticated;
grant execute on function public.cone_clash_get_session(uuid) to anon, authenticated, service_role;
grant execute on function public.cone_clash_logout_user(uuid) to anon, authenticated;

do $block$
declare
  v_function record;
begin
  for v_function in
    select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as argument_types
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('register_user', 'login_user', 'get_session', 'logout_user')
  loop
    execute pg_catalog.format(
      'revoke all on function public.%I(%s) from public, anon, authenticated',
      v_function.proname,
      v_function.argument_types
    );
  end loop;
end;
$block$;

create or replace function public.admin_list_game_table(
  p_session_token uuid,
  p_table_name text,
  p_offset integer,
  p_limit integer
)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.user_sessions as s
    join public.users as u on u.id = s.user_id
    where s.token = p_session_token
      and u.role = 'admin'
      and u.account_status = 'active'
      and (s.expires_at is null or s.expires_at > pg_catalog.now())
  ) then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if p_offset is null or p_offset < 0
    or p_limit is null or p_limit < 1 or p_limit > 50
  then
    raise exception 'Invalid pagination parameters.';
  end if;

  if p_table_name = 'matches' then
    return query
      select pg_catalog.to_jsonb(m)
      from public.matches as m
      order by m.id asc
      offset p_offset
      limit p_limit;
  elsif p_table_name = 'players' then
    return query
      select pg_catalog.to_jsonb(p)
      from public.players as p
      order by p.id asc
      offset p_offset
      limit p_limit;
  elsif p_table_name = 'match_participants' then
    return query
      select pg_catalog.to_jsonb(mp)
      from public.match_participants as mp
      order by mp.match_id asc, mp.player_id asc
      offset p_offset
      limit p_limit;
  else
    raise exception 'Unsupported admin table.';
  end if;
end;
$function$;

revoke all on function public.admin_list_game_table(uuid, text, integer, integer) from public;
grant execute on function public.admin_list_game_table(uuid, text, integer, integer) to anon, authenticated;

create or replace function public.admin_delete_game_record(
  p_session_token uuid,
  p_table_name text,
  p_record_id uuid,
  p_related_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted_count bigint;
begin
  if not exists (
    select 1
    from public.user_sessions as s
    join public.users as u on u.id = s.user_id
    where s.token = p_session_token
      and u.role = 'admin'
      and u.account_status = 'active'
      and (s.expires_at is null or s.expires_at > pg_catalog.now())
  ) then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if p_record_id is null then
    raise exception 'A record identifier is required.';
  end if;

  if p_table_name = 'matches' then
    delete from public.match_participants
    where match_id = p_record_id;

    delete from public.matches
    where id = p_record_id;
    get diagnostics v_deleted_count = row_count;
  elsif p_table_name = 'players' then
    delete from public.match_participants
    where player_id = p_record_id;

    delete from public.players
    where id = p_record_id;
    get diagnostics v_deleted_count = row_count;
  elsif p_table_name = 'match_participants' then
    if p_related_id is null then
      raise exception 'A player identifier is required for match participants.';
    end if;

    delete from public.match_participants
    where match_id = p_record_id
      and player_id = p_related_id;
    get diagnostics v_deleted_count = row_count;
  else
    raise exception 'Unsupported admin table.';
  end if;

  if v_deleted_count = 0 then
    raise exception 'Record not found or already deleted.';
  end if;
end;
$function$;

revoke all on function public.admin_delete_game_record(uuid, text, uuid, uuid) from public;
grant execute on function public.admin_delete_game_record(uuid, text, uuid, uuid) to anon, authenticated;

create or replace function public.admin_save_game_record(
  p_session_token uuid,
  p_table_name text,
  p_operation text,
  p_data jsonb,
  p_record_id uuid default null,
  p_related_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_affected_count bigint;
  v_room_name text;
  v_total_rounds integer;
  v_ended_at timestamp with time zone;
  v_username text;
  v_favorite_color text;
  v_avatar_url text;
  v_match_id uuid;
  v_player_id uuid;
  v_round_wins integer;
  v_cones_collected integer;
  v_is_winner boolean;
begin
  if not exists (
    select 1
    from public.user_sessions as s
    join public.users as u on u.id = s.user_id
    where s.token = p_session_token
      and u.role = 'admin'
      and u.account_status = 'active'
      and (s.expires_at is null or s.expires_at > pg_catalog.now())
  ) then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if p_operation is null or p_operation not in ('create', 'update') then
    raise exception 'Unsupported record operation.';
  end if;

  if p_data is null or pg_catalog.jsonb_typeof(p_data) <> 'object' then
    raise exception 'Record data must be an object.';
  end if;

  if p_table_name = 'matches' then
    v_room_name := pg_catalog.btrim(p_data ->> 'room_name');
    v_total_rounds := nullif(p_data ->> 'total_rounds', '')::integer;
    v_ended_at := nullif(p_data ->> 'ended_at', '')::timestamp with time zone;

    if v_room_name is null or v_room_name = '' or pg_catalog.char_length(v_room_name) > 100 then
      raise exception 'Room name must be between 1 and 100 characters.';
    end if;
    if v_total_rounds is null or v_total_rounds < 1 then
      raise exception 'Total rounds must be a positive number.';
    end if;
    if v_ended_at is null then
      raise exception 'A match end time is required.';
    end if;

    if p_operation = 'create' then
      insert into public.matches (room_name, status, total_rounds, ended_at)
      values (v_room_name, 'completed', v_total_rounds, v_ended_at);
      get diagnostics v_affected_count = row_count;
    else
      if p_record_id is null then
        raise exception 'A match identifier is required for updates.';
      end if;

      update public.matches
      set room_name = v_room_name,
          total_rounds = v_total_rounds,
          ended_at = v_ended_at
      where id = p_record_id;
      get diagnostics v_affected_count = row_count;
    end if;
  elsif p_table_name = 'players' then
    v_username := pg_catalog.btrim(p_data ->> 'username');
    v_favorite_color := pg_catalog.btrim(p_data ->> 'favorite_color');
    v_avatar_url := nullif(pg_catalog.btrim(p_data ->> 'avatar_url'), '');

    if v_username is null or v_username = '' or pg_catalog.char_length(v_username) > 16 then
      raise exception 'Username must be between 1 and 16 characters.';
    end if;
    if v_favorite_color is null or v_favorite_color !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Favorite color must be a six-digit hex color.';
    end if;
    if v_avatar_url is not null
      and (pg_catalog.char_length(v_avatar_url) > 2048 or v_avatar_url !~* '^https?://')
    then
      raise exception 'Avatar URL must be a valid HTTP or HTTPS URL.';
    end if;

    if p_operation = 'create' then
      insert into public.players (username, favorite_color, avatar_url)
      values (v_username, v_favorite_color, v_avatar_url);
      get diagnostics v_affected_count = row_count;
    else
      if p_record_id is null then
        raise exception 'A player identifier is required for updates.';
      end if;

      update public.players
      set username = v_username,
          favorite_color = v_favorite_color,
          avatar_url = v_avatar_url
      where id = p_record_id;
      get diagnostics v_affected_count = row_count;
    end if;
  elsif p_table_name = 'match_participants' then
    v_match_id := nullif(p_data ->> 'match_id', '')::uuid;
    v_player_id := nullif(p_data ->> 'player_id', '')::uuid;
    v_round_wins := nullif(p_data ->> 'round_wins', '')::integer;
    v_cones_collected := nullif(p_data ->> 'cones_collected', '')::integer;
    v_is_winner := coalesce(nullif(p_data ->> 'is_winner', '')::boolean, false);

    if v_match_id is null or v_player_id is null then
      raise exception 'Choose both a match and a player.';
    end if;
    if v_round_wins is null or v_round_wins < 0
      or v_cones_collected is null or v_cones_collected < 0
    then
      raise exception 'Round wins and cones collected must be zero or greater.';
    end if;

    if p_operation = 'create' then
      insert into public.match_participants (
        match_id,
        player_id,
        round_wins,
        cones_collected,
        is_winner
      )
      values (
        v_match_id,
        v_player_id,
        v_round_wins,
        v_cones_collected,
        v_is_winner
      );
      get diagnostics v_affected_count = row_count;
    else
      if p_record_id is null or p_related_id is null then
        raise exception 'Original match and player identifiers are required for updates.';
      end if;

      update public.match_participants
      set match_id = v_match_id,
          player_id = v_player_id,
          round_wins = v_round_wins,
          cones_collected = v_cones_collected,
          is_winner = v_is_winner
      where match_id = p_record_id
        and player_id = p_related_id;
      get diagnostics v_affected_count = row_count;
    end if;
  else
    raise exception 'Unsupported admin table.';
  end if;

  if v_affected_count = 0 then
    raise exception 'Record not found or already deleted.';
  end if;
end;
$function$;

revoke all on function public.admin_save_game_record(uuid, text, text, jsonb, uuid, uuid) from public;
grant execute on function public.admin_save_game_record(uuid, text, text, jsonb, uuid, uuid) to anon, authenticated;
