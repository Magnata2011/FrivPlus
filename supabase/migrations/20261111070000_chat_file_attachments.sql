alter table public.chat_messages
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

alter table public.chat_messages
  drop constraint if exists chat_messages_attachment_metadata_check;

alter table public.chat_messages
  add constraint chat_messages_attachment_metadata_check
  check (
    (attachment_name is null and attachment_type is null)
    or (
      image_path is not null
      and attachment_name is not null
      and char_length(attachment_name) between 1 and 180
      and attachment_type is not null
      and attachment_type in (
        'image/png',
        'image/jpeg',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  26214400,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop function if exists public.get_chat_messages(uuid);

create function public.get_chat_messages(p_conversation_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  image_path text,
  attachment_name text,
  attachment_type text,
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
    select
      messages.id,
      messages.sender_id,
      coalesce(profiles.display_name, profiles.username, 'Usuário'),
      messages.body,
      messages.image_path,
      messages.attachment_name,
      messages.attachment_type,
      messages.created_at
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

grant execute on function public.get_chat_messages(uuid) to authenticated;
revoke all on function public.get_chat_messages(uuid) from public, anon;

create or replace function public.send_chat_attachment_message(
  p_conversation_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_type text default null
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
    or (clean_body = '' and p_attachment_path is null) then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;
  if p_attachment_path is not null and p_attachment_path not like (
    p_conversation_id::text || '/' || caller_id::text || '/%'
  ) then
    raise exception using errcode = '22023', message = 'invalid_attachment_path';
  end if;
  if p_attachment_path is null and (p_attachment_name is not null or p_attachment_type is not null) then
    raise exception using errcode = '22023', message = 'invalid_attachment_metadata';
  end if;
  if p_attachment_path is not null and (
    p_attachment_name is null
    or pg_catalog.char_length(p_attachment_name) not between 1 and 180
    or p_attachment_type is null
    or p_attachment_type not in (
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_attachment_metadata';
  end if;

  insert into public.chat_messages (
    conversation_id,
    sender_id,
    body,
    image_path,
    attachment_name,
    attachment_type
  )
  values (
    p_conversation_id,
    caller_id,
    clean_body,
    p_attachment_path,
    p_attachment_name,
    p_attachment_type
  )
  returning id into message_id;

  return message_id;
end;
$$;

revoke all on function public.send_chat_attachment_message(uuid, text, text, text, text) from public, anon;
grant execute on function public.send_chat_attachment_message(uuid, text, text, text, text) to authenticated;
