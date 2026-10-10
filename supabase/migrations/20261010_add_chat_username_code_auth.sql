-- SunShine Chat: device-independent username + code authentication.
-- Existing users are preserved. Legacy usernames receive a code only after
-- successful proof from their original device. Codes are never stored in plaintext.

alter table public.sunshine_chat_users
  add column if not exists code_hash text null,
  add column if not exists code_salt text null;

create table if not exists public.sunshine_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.sunshine_chat_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null
);

create index if not exists sunshine_chat_sessions_user_id_idx
  on public.sunshine_chat_sessions(user_id);

create index if not exists sunshine_chat_sessions_expires_at_idx
  on public.sunshine_chat_sessions(expires_at);

alter table public.sunshine_chat_sessions enable row level security;
