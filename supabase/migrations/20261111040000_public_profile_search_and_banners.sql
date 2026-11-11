alter table public.profiles
  add column if not exists banner_path text
    check (banner_path is null or banner_path = (id::text || '/banner'));

grant update (banner_path) on public.profiles to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-banners',
  'profile-banners',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their own profile banner objects" on storage.objects;
create policy "Users read their own profile banner objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-banners'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'banner'
  );

drop policy if exists "Users upload their own profile banner" on storage.objects;
create policy "Users upload their own profile banner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-banners'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'banner'
  );

drop policy if exists "Users update their own profile banner" on storage.objects;
create policy "Users update their own profile banner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-banners'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'banner'
  )
  with check (
    bucket_id = 'profile-banners'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'banner'
  );

create or replace function public.search_public_profiles(p_search_query text)
returns table (
  username text,
  display_name text,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.username, profiles.display_name, profiles.avatar_path
  from public.profiles as profiles
  where profiles.username is not null
    and pg_catalog.length(pg_catalog.btrim(p_search_query)) between 2 and 40
    and (
      pg_catalog.strpos(pg_catalog.lower(profiles.username), pg_catalog.lower(pg_catalog.btrim(p_search_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(profiles.display_name), pg_catalog.lower(pg_catalog.btrim(p_search_query))) > 0
    )
  order by
    (profiles.username = pg_catalog.lower(pg_catalog.btrim(p_search_query))) desc,
    pg_catalog.lower(profiles.display_name),
    profiles.username
  limit 8;
$$;

create or replace function public.get_public_profile(p_username text)
returns table (
  username text,
  display_name text,
  bio text,
  avatar_path text,
  banner_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.username, profiles.display_name, profiles.bio, profiles.avatar_path, profiles.banner_path
  from public.profiles as profiles
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and profiles.username is not null
  limit 1;
$$;

revoke all on function public.search_public_profiles(text) from public;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.search_public_profiles(text) to anon, authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
