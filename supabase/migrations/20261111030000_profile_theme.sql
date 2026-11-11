alter table public.profiles
  add column if not exists theme text not null default 'dark'
    check (theme in ('dark', 'light'));

grant update (theme) on public.profiles to authenticated;
