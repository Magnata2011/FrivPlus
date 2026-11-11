create table if not exists public.site_changelogs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 2000),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.site_changelogs enable row level security;
revoke all on public.site_changelogs from anon, authenticated;

create or replace function public.get_public_changelogs()
returns table (id uuid, title text, message text)
language sql
stable
security definer
set search_path = ''
as $$
  select changelogs.id, changelogs.title, changelogs.message
  from public.site_changelogs as changelogs
  order by changelogs.created_at desc
  limit 5;
$$;

revoke all on function public.get_public_changelogs() from public;
grant execute on function public.get_public_changelogs() to anon, authenticated;

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  name text check (name is null or char_length(name) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  image_path text,
  created_at timestamptz not null default now(),
  check (body <> '' or image_path is not null)
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_conversations, public.chat_members, public.chat_messages from anon, authenticated;

create or replace function public.is_chat_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid() and exists (
    select 1
    from public.chat_members as members
    where members.conversation_id = p_conversation_id
      and members.user_id = p_user_id
  );
$$;

create or replace function public.list_accepted_friends()
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.id, profiles.username, profiles.display_name, profiles.avatar_path
  from public.friendships as friendships
  join public.profiles as profiles
    on profiles.id = case
      when friendships.user_low = auth.uid() then friendships.user_high
      else friendships.user_low
    end
  where friendships.status = 'accepted'
    and (friendships.user_low = auth.uid() or friendships.user_high = auth.uid())
    and profiles.username is not null
  order by pg_catalog.lower(profiles.display_name), profiles.username;
$$;

create or replace function public.create_chat_conversation(p_user_ids uuid[], p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  conversation_id uuid;
  member_id uuid;
  clean_name text := nullif(pg_catalog.btrim(p_name), '');
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_user_ids is null or pg_catalog.cardinality(p_user_ids) < 1
    or pg_catalog.cardinality(p_user_ids) > 19 then
    raise exception using errcode = '22023', message = 'invalid_member_count';
  end if;
  if (select pg_catalog.count(distinct requested_id) from pg_catalog.unnest(p_user_ids) as requested(requested_id))
    <> pg_catalog.cardinality(p_user_ids)
    or caller_id = any(p_user_ids) then
    raise exception using errcode = '22023', message = 'duplicate_or_self_member';
  end if;
  if clean_name is not null and pg_catalog.char_length(clean_name) > 80 then
    raise exception using errcode = '22023', message = 'invalid_conversation_name';
  end if;

  foreach member_id in array p_user_ids loop
    if not exists (
      select 1 from public.friendships as friendships
      where friendships.status = 'accepted'
        and (
          (friendships.user_low = caller_id and friendships.user_high = member_id)
          or (friendships.user_high = caller_id and friendships.user_low = member_id)
        )
    ) then
      raise exception using errcode = '42501', message = 'all_members_must_be_friends';
    end if;
  end loop;

  insert into public.chat_conversations (name, created_by)
  values (clean_name, caller_id)
  returning id into conversation_id;

  insert into public.chat_members (conversation_id, user_id)
  values (conversation_id, caller_id);
  insert into public.chat_members (conversation_id, user_id)
  select conversation_id, requested_id
  from pg_catalog.unnest(p_user_ids) as requested(requested_id);

  return conversation_id;
end;
$$;

create or replace function public.list_my_chat_conversations()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  is_group boolean,
  members jsonb,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    conversations.id,
    conversations.name,
    conversations.created_at,
    pg_catalog.count(members.user_id) > 2 as is_group,
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', profiles.id,
          'username', profiles.username,
          'displayName', coalesce(profiles.display_name, profiles.username),
          'avatarPath', profiles.avatar_path
        ) order by pg_catalog.lower(coalesce(profiles.display_name, profiles.username))
      ),
      '[]'::jsonb
    ) as members,
    latest.body as last_message,
    latest.created_at as last_message_at
  from public.chat_conversations as conversations
  join public.chat_members as mine
    on mine.conversation_id = conversations.id
    and mine.user_id = auth.uid()
  join public.chat_members as members on members.conversation_id = conversations.id
  join public.profiles as profiles on profiles.id = members.user_id
  left join lateral (
    select
      case when messages.body = '' and messages.image_path is not null then '[Imagem]'
        else messages.body
      end as body,
      messages.created_at
    from public.chat_messages as messages
    where messages.conversation_id = conversations.id
    order by messages.created_at desc
    limit 1
  ) as latest on true
  group by conversations.id, latest.body, latest.created_at
  order by coalesce(latest.created_at, conversations.created_at) desc;
$$;

create or replace function public.get_chat_messages(p_conversation_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  image_path text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_chat_member(p_conversation_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'conversation_access_denied';
  end if;

  return query
    select messages.id, messages.sender_id,
      coalesce(profiles.display_name, profiles.username, 'Usuário'),
      messages.body, messages.image_path, messages.created_at
    from (
      select all_messages.*
      from public.chat_messages as all_messages
      where all_messages.conversation_id = p_conversation_id
      order by all_messages.created_at desc
      limit 100
    ) as messages
    join public.profiles as profiles on profiles.id = messages.sender_id
    order by messages.created_at asc;
end;
$$;

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  message_id uuid;
  clean_body text := pg_catalog.btrim(p_body);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not public.is_chat_member(p_conversation_id, caller_id) then
    raise exception using errcode = '42501', message = 'conversation_access_denied';
  end if;
  if pg_catalog.char_length(clean_body) > 2000
    or (clean_body = '' and p_image_path is null) then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;
  if p_image_path is not null and p_image_path not like (
    p_conversation_id::text || '/' || caller_id::text || '/%'
  ) then
    raise exception using errcode = '22023', message = 'invalid_image_path';
  end if;

  insert into public.chat_messages (conversation_id, sender_id, body, image_path)
  values (p_conversation_id, caller_id, clean_body, p_image_path)
  returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.is_chat_member(uuid, uuid) from public, anon;
revoke all on function public.list_accepted_friends() from public, anon;
revoke all on function public.create_chat_conversation(uuid[], text) from public, anon;
revoke all on function public.list_my_chat_conversations() from public, anon;
revoke all on function public.get_chat_messages(uuid) from public, anon;
revoke all on function public.send_chat_message(uuid, text, text) from public, anon;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;
grant execute on function public.list_accepted_friends() to authenticated;
grant execute on function public.create_chat_conversation(uuid[], text) to authenticated;
grant execute on function public.list_my_chat_conversations() to authenticated;
grant execute on function public.get_chat_messages(uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat members upload conversation images" on storage.objects;
create policy "Chat members upload conversation images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_chat_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );

drop policy if exists "Chat members read conversation images" on storage.objects;
create policy "Chat members read conversation images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and public.is_chat_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );
