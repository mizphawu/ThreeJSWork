drop function if exists public.admin_list_users(text);
drop function if exists public.admin_list_users(uuid);

create or replace function public.admin_list_users(p_session_token uuid)
returns table (
  user_id uuid,
  username character varying,
  role character varying,
  account_status character varying,
  last_activity timestamp with time zone
)
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
      and (s.expires_at is null or s.expires_at > pg_catalog.now())
  ) then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  return query
  select
    u.id,
    u.username,
    u.role,
    u.account_status,
    u.last_activity
  from public.users as u
  order by u.username asc;
end;
$function$;

revoke all on function public.admin_list_users(uuid) from public;
grant execute on function public.admin_list_users(uuid) to anon, authenticated;

create or replace function public.admin_list_user_sessions(p_session_token uuid)
returns table (
  username character varying,
  account_status character varying,
  created_at timestamp with time zone,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.user_sessions as admin_session
    join public.users as admin_user on admin_user.id = admin_session.user_id
    where admin_session.token = p_session_token
      and admin_user.role = 'admin'
      and admin_user.account_status = 'active'
      and (admin_session.expires_at is null or admin_session.expires_at > pg_catalog.now())
  ) then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  return query
  select
    u.username,
    u.account_status,
    s.created_at,
    s.expires_at
  from public.user_sessions as s
  join public.users as u on u.id = s.user_id
  order by s.created_at desc nulls last, u.username asc;
end;
$function$;

revoke all on function public.admin_list_user_sessions(uuid) from public;
grant execute on function public.admin_list_user_sessions(uuid) to anon, authenticated;

create or replace function public.admin_delete_user(
  p_session_token uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_user_id uuid;
  v_target_role character varying;
  v_target_status character varying;
begin
  select u.id
  into v_admin_user_id
  from public.user_sessions as s
  join public.users as u on u.id = s.user_id
  where s.token = p_session_token
    and u.role = 'admin'
    and (s.expires_at is null or s.expires_at > pg_catalog.now());

  if v_admin_user_id is null then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if v_admin_user_id = p_user_id then
    raise exception 'You cannot delete your own admin account.';
  end if;

  select u.role, u.account_status
  into v_target_role, v_target_status
  from public.users as u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found.';
  end if;

  if v_target_role = 'admin'
    and v_target_status = 'active'
    and (
      select count(*)
      from public.users as u
      where u.role = 'admin'
        and u.account_status = 'active'
    ) <= 1
  then
    raise exception 'You cannot delete the last active administrator.';
  end if;

  delete from public.user_sessions as s
  where s.user_id = p_user_id;

  delete from public.users as u
  where u.id = p_user_id;
end;
$function$;

revoke all on function public.admin_delete_user(uuid, uuid) from public;
grant execute on function public.admin_delete_user(uuid, uuid) to anon, authenticated;
