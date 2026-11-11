create table if not exists public.site_settings (
  id text primary key check (id = 'maintenance'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, enabled)
values ('maintenance', true)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant all on public.site_settings to service_role;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);
