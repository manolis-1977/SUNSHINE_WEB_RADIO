alter table public.sunshine_chat_users
  add column if not exists blocked_until timestamp with time zone null;

create index if not exists sunshine_chat_users_blocked_until_idx
  on public.sunshine_chat_users (blocked_until)
  where blocked = true and blocked_until is not null;
