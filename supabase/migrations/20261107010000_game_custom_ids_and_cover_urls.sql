alter table public.games
  alter column id drop default,
  alter column id type text using id::text,
  alter column cover_path drop not null,
  add column if not exists cover_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_single_cover_source'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_single_cover_source check (
        (cover_path is not null and cover_url is null)
        or (cover_path is null and cover_url is not null)
      );
  end if;
end
$$;
