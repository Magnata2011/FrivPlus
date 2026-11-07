create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1500),
  cover_path text not null,
  category text not null check (char_length(category) between 1 and 50),
  tags text[] not null default '{}',
  featured boolean not null default false,
  published boolean not null default false,
  game_file_path text,
  game_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_single_source check (
    (game_file_path is not null and game_url is null)
    or (game_file_path is null and game_url is not null)
  )
);

create index if not exists games_published_featured_created_idx
  on public.games (published, featured desc, created_at desc);

alter table public.games enable row level security;

revoke all on public.games from anon, authenticated;
grant select on public.games to anon, authenticated;
grant all on public.games to service_role;

drop policy if exists "Anyone can read published games" on public.games;
create policy "Anyone can read published games"
  on public.games
  for select
  to anon, authenticated
  using (published = true);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'game-assets',
  'game-assets',
  false,
  2621440,
  array['image/jpeg', 'image/png', 'image/webp', 'text/html']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Published game assets are readable" on storage.objects;
create policy "Published game assets are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'game-assets'
    and exists (
      select 1
      from public.games
      where public.games.published = true
        and (
          public.games.cover_path = storage.objects.name
          or public.games.game_file_path = storage.objects.name
        )
    )
  );
