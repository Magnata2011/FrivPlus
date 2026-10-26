-- FrivPlus V2: schema inicial para Supabase Postgres.
-- Execute no SQL Editor de um projeto novo. Novas contas nunca recebem admin automaticamente.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  category text not null default 'Outros',
  cover_url text,
  launch_type text not null check (launch_type in ('storage', 'external')),
  launch_url text not null,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  save_type text not null check (save_type in ('file', 'progress')),
  storage_path text,
  progress jsonb,
  label text not null default 'Meu save',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint save_payload_matches_type check (
    (save_type = 'file' and storage_path is not null and progress is null)
    or (save_type = 'progress' and progress is not null and storage_path is null)
  )
);

create index if not exists games_published_idx on public.games (published, category);
create index if not exists game_saves_user_game_idx on public.game_saves (user_id, game_id, updated_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_saves enable row level security;

-- Helper checks role without allowing users to edit their own role.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Users can read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "Users can update own basic profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = 'user');
create policy "Admins can update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read published games" on public.games
  for select to anon, authenticated using (published or public.is_admin());
create policy "Admins can insert games" on public.games
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update games" on public.games
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete games" on public.games
  for delete to authenticated using (public.is_admin());

create policy "Users can read own saves" on public.game_saves
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Users can create own saves" on public.game_saves
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users can update own saves" on public.game_saves
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can delete own saves" on public.game_saves
  for delete to authenticated using (user_id = (select auth.uid()));

-- Criar buckets no painel Storage:
-- 1. game-files: jogos/arquivos que você tem autorização para hospedar.
-- 2. game-covers: capas e miniaturas públicas.
-- 3. user-saves: arquivos de save privados.
-- Defina políticas de Storage para admin no game-files e acesso por pasta de usuário em user-saves.
-- Não torne o bucket user-saves público.
--
-- Para conceder o primeiro administrador, após criar a conta:
-- update public.profiles set role = 'admin' where id = 'UUID-DA-CONTA';
-- Faça isso somente no SQL Editor como proprietário do projeto.
