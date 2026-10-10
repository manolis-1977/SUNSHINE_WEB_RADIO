-- SunShine Chat: device-independent username + code authentication.
-- Existing chat users are preserved. Their login_code_* values stay NULL until
-- the legacy owner upgrades the account from the original device.

alter table public.sunshine_chat_users
  add column if not exists login_code_hash text null,
  add column if not exists login_code_salt text null,
  add column if not exists login_failures integer not null default 0,
  add column if not exists login_locked_until timestamp with time zone null;

create table if not exists public.sunshine_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.sunshine_chat_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  revoked_at timestamp with time zone null
);

create index if not exists sunshine_chat_sessions_user_id_idx
  on public.sunshine_chat_sessions(user_id);

create index if not exists sunshine_chat_sessions_active_idx
  on public.sunshine_chat_sessions(token_hash, expires_at)
  where revoked_at is null;

alter table public.sunshine_chat_sessions enable row level security;
