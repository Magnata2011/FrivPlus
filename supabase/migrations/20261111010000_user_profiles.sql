create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text check (
    username is null or (
      username = lower(username)
      and username ~ '^[a-z0-9_]{3,24}$'
    )
  ),
  display_name text not null default ''
    check (char_length(display_name) <= 60 and display_name = btrim(display_name)),
  bio text not null default ''
    check (char_length(bio) <= 500 and bio = btrim(bio)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio) on public.profiles to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users create their own profile" on public.profiles;
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

create or replace function public.update_profile_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.update_profile_timestamp() from public, anon, authenticated;

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
  before update on public.profiles
  for each row execute function public.update_profile_timestamp();

drop trigger if exists create_profile_after_user_signup on auth.users;
create trigger create_profile_after_user_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, display_name)
select
  users.id,
  left(btrim(coalesce(users.raw_user_meta_data ->> 'display_name', '')), 60)
from auth.users as users
on conflict (id) do nothing;
