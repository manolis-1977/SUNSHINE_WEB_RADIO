-- SunShine Chat shared message reactions.
create table if not exists public.sunshine_chat_message_reactions (
  message_id uuid not null references public.sunshine_chat_messages(id) on delete cascade,
  user_id uuid not null references public.sunshine_chat_users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction),
  constraint sunshine_chat_message_reactions_allowed_check
    check (reaction in ('❤️','👍','😂','🔥','👏'))
);

create index if not exists sunshine_chat_message_reactions_message_idx
  on public.sunshine_chat_message_reactions(message_id);

create index if not exists sunshine_chat_message_reactions_user_idx
  on public.sunshine_chat_message_reactions(user_id);

alter table public.sunshine_chat_message_reactions enable row level security;
