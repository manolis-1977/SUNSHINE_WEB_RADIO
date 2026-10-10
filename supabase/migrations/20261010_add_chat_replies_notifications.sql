-- SunShine Chat replies + persistent user notifications.

alter table public.sunshine_chat_messages
  add column if not exists reply_to_message_id uuid null
  references public.sunshine_chat_messages(id) on delete set null;

create index if not exists sunshine_chat_messages_reply_to_idx
  on public.sunshine_chat_messages(reply_to_message_id)
  where reply_to_message_id is not null;

create table if not exists public.sunshine_chat_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.sunshine_chat_users(id) on delete cascade,
  actor_user_id uuid null references public.sunshine_chat_users(id) on delete set null,
  type text not null check (type in ('reaction','reply')),
  message_id uuid null references public.sunshine_chat_messages(id) on delete cascade,
  reaction text null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists sunshine_chat_notifications_unread_idx
  on public.sunshine_chat_notifications(user_id, created_at)
  where read_at is null;

create unique index if not exists sunshine_chat_notifications_dedupe_idx
  on public.sunshine_chat_notifications(
    user_id,
    coalesce(actor_user_id,'00000000-0000-0000-0000-000000000000'::uuid),
    type,
    coalesce(message_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(reaction,'')
  );

alter table public.sunshine_chat_notifications enable row level security;
