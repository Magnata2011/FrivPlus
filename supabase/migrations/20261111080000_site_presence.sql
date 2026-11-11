alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists current_game_id text
    check (current_game_id is null or current_game_id ~ '^[a-z0-9][a-z0-9-]{0,79}$');

create or replace function public.update_my_presence(p_game_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_game_id is not null and p_game_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception using errcode = '22023', message = 'invalid_game_id';
  end if;

  update public.profiles
  set last_seen_at = pg_catalog.now(),
      current_game_id = p_game_id
  where id = caller_id
    and (
      current_game_id is distinct from p_game_id
      or last_seen_at is null
      or last_seen_at < pg_catalog.now() - interval '30 seconds'
    );
end;
$$;

revoke all on function public.update_my_presence(text) from public, anon;
grant execute on function public.update_my_presence(text) to authenticated;

drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_username text)
returns table (
  username text,
  display_name text,
  bio text,
  avatar_path text,
  banner_path text,
  is_online boolean,
  current_game_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.username,
    profiles.display_name,
    profiles.bio,
    profiles.avatar_path,
    profiles.banner_path,
    coalesce(profiles.last_seen_at >= pg_catalog.now() - interval '3 minutes', false),
    case
      when profiles.last_seen_at >= pg_catalog.now() - interval '3 minutes'
        then profiles.current_game_id
      else null
    end
  from public.profiles as profiles
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and profiles.username is not null
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
