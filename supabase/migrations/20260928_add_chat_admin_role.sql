alter table public.sunshine_chat_users
  add column if not exists is_admin boolean not null default false;

alter table public.sunshine_chat_messages
  add column if not exists deleted_by_chat_user uuid null
  references public.sunshine_chat_users(id) on delete set null;

alter table public.sunshine_chat_moderation_log
  add column if not exists chat_admin_user_id uuid null
  references public.sunshine_chat_users(id) on delete set null;

create index if not exists sunshine_chat_users_is_admin_idx
  on public.sunshine_chat_users (is_admin)
  where is_admin = true;
