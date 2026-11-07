create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (
    username is null or username ~ '^[A-Za-z0-9_]{3,24}$'
  ),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_path text,
  banner_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-assets',
  'profile-assets',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own profile images" on storage.objects;
create policy "Users read own profile images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload own profile images" on storage.objects;
create policy "Users upload own profile images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update own profile images" on storage.objects;
create policy "Users update own profile images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete own profile images" on storage.objects;
create policy "Users delete own profile images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
