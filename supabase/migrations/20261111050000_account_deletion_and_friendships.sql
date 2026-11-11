create table if not exists public.friendships (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by = user_low or requested_by = user_high)
);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

create or replace function public.get_friendship_status(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_id uuid;
  low_id uuid;
  high_id uuid;
  relationship_status text;
  requester_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select profiles.id
  into target_id
  from public.profiles as profiles
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and profiles.username is not null;

  if target_id is null then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  if caller_id = target_id then
    return 'self';
  end if;

  if caller_id < target_id then
    low_id := caller_id;
    high_id := target_id;
  else
    low_id := target_id;
    high_id := caller_id;
  end if;

  select friendships.status, friendships.requested_by
  into relationship_status, requester_id
  from public.friendships as friendships
  where friendships.user_low = low_id
    and friendships.user_high = high_id;

  if relationship_status = 'accepted' then
    return 'accepted';
  end if;
  if relationship_status = 'pending' and requester_id = caller_id then
    return 'outgoing';
  end if;
  if relationship_status = 'pending' then
    return 'incoming';
  end if;
  return 'none';
end;
$$;

create or replace function public.request_friendship(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_id uuid;
  low_id uuid;
  high_id uuid;
  relationship_status text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select profiles.id
  into target_id
  from public.profiles as profiles
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and profiles.username is not null;

  if target_id is null then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  if caller_id = target_id then
    raise exception using errcode = '22023', message = 'cannot_friend_self';
  end if;

  if caller_id < target_id then
    low_id := caller_id;
    high_id := target_id;
  else
    low_id := target_id;
    high_id := caller_id;
  end if;

  insert into public.friendships as existing_friendship (
    user_low,
    user_high,
    requested_by,
    status
  )
  values (
    low_id,
    high_id,
    caller_id,
    'pending'
  )
  on conflict (user_low, user_high)
  do update set
    status = case
      when existing_friendship.status = 'pending'
        and existing_friendship.requested_by <> excluded.requested_by
      then 'accepted'
      else existing_friendship.status
    end,
    updated_at = case
      when existing_friendship.status = 'pending'
        and existing_friendship.requested_by <> excluded.requested_by
      then pg_catalog.now()
      else existing_friendship.updated_at
    end
  returning status into relationship_status;

  if relationship_status = 'accepted' then
    return 'accepted';
  end if;
  return 'outgoing';
end;
$$;

revoke all on function public.get_friendship_status(text) from public, anon;
revoke all on function public.request_friendship(text) from public, anon;
grant execute on function public.get_friendship_status(text) to authenticated;
grant execute on function public.request_friendship(text) to authenticated;
