-- SunShine Chat: real username/password accounts.
-- Passwords are stored only as salted PBKDF2 hashes.

alter table public.sunshine_chat_users
  add column if not exists password_hash text null,
  add column if not exists password_salt text null,
  add column if not exists password_failures integer not null default 0,
  add column if not exists password_locked_until timestamp with time zone null;
