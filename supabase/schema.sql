-- TopicLens database schema for Supabase.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
--
-- profiles      one row per user: display name, chosen sections, starting history
-- preferences   one row per user: topic sliders, mutes, More/Less, Not interested, passed-over counts
-- interactions  append-only log: every click, read, like, dislike, dismiss and skip, with time and rank
--
-- Row-level security: every user can read and write only their own rows.
-- Policies use (select auth.uid()) so Postgres evaluates it once per query, not once per row.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null default '',
  sections      text[] not null default '{}',
  seed_history  text[] not null default '{}',
  -- "Reset my profile": the history only counts clicks and reads after this moment.
  reset_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  multipliers jsonb  not null default '{}'::jsonb,
  muted       int[]  not null default '{}',
  liked       text[] not null default '{}',
  disliked    text[] not null default '{}',
  dismissed   text[] not null default '{}',
  skipped     jsonb  not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.interactions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  article_id  text not null,
  kind        text not null check (kind in ('click', 'read', 'like', 'dislike', 'dismiss', 'skip')),
  rank        int,
  created_at  timestamptz not null default now()
);
create index if not exists interactions_user_time on public.interactions (user_id, created_at);
alter table public.profiles add column if not exists reset_at timestamptz;

alter table public.profiles     enable row level security;
alter table public.preferences  enable row level security;
alter table public.interactions enable row level security;

drop policy if exists "own profile"       on public.profiles;
drop policy if exists "own preferences"   on public.preferences;
drop policy if exists "read own interactions"   on public.interactions;
drop policy if exists "insert own interactions" on public.interactions;

create policy "own profile" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "own preferences" on public.preferences
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- The interaction log is append-only for users: they can read and add, not edit or delete.
create policy "read own interactions" on public.interactions
  for select using ((select auth.uid()) = user_id);
create policy "insert own interactions" on public.interactions
  for insert with check ((select auth.uid()) = user_id);

-- Create the profile and preferences rows when a user signs up (email, Google or anonymous guest).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name',
             split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do nothing;
  insert into public.preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger function runs with elevated rights; nobody should call it directly through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
