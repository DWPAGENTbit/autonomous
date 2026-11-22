-- DWP EARN MONEY: private storage and 15-minute schedule for the trading bot.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- The bot keeps one JSON row (settings, positions, journal, monthly results) in the
-- private schema dwp_bot, which the Data API does not expose. The app reaches it only
-- through dwp_bot_read and dwp_bot_write, which check a token (DWP_DB_TOKEN) against a
-- hash stored here. So the publishable key alone can neither read nor change anything.
--
-- Before running, put the SHA-256 (hex) of DWP_DB_TOKEN in the insert near the bottom.
-- The schedule's own key is made here and never leaves the database.

create schema if not exists dwp_bot;
revoke all on schema dwp_bot from public, anon, authenticated;

create table if not exists dwp_bot.state (
  id text primary key,
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists dwp_bot.access (
  id int primary key default 1 check (id = 1),
  token_hash text not null,
  tick_secret text not null
);

alter table dwp_bot.state enable row level security;
alter table dwp_bot.access enable row level security;
revoke all on all tables in schema dwp_bot from public, anon, authenticated;

create or replace function dwp_bot.allowed(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from dwp_bot.access a
    where a.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  );
$$;
revoke all on function dwp_bot.allowed(text) from public, anon, authenticated;

create or replace function public.dwp_bot_read(p_token text, p_id text)
returns table (state jsonb, version bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not dwp_bot.allowed(p_token) then
    raise exception 'akses ditolak' using errcode = '42501';
  end if;
  return query select s.state, s.version from dwp_bot.state s where s.id = p_id;
end;
$$;

-- Saves only if the row is still at p_version (null = first save). Returns the new
-- version, or null when someone else saved first.
create or replace function public.dwp_bot_write(p_token text, p_id text, p_state jsonb, p_version bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  if not dwp_bot.allowed(p_token) then
    raise exception 'akses ditolak' using errcode = '42501';
  end if;
  if p_version is null then
    insert into dwp_bot.state as s (id, state) values (p_id, p_state)
    on conflict (id) do nothing
    returning s.version into v;
  else
    update dwp_bot.state s
       set state = p_state, version = s.version + 1, updated_at = now()
     where s.id = p_id and s.version = p_version
    returning s.version into v;
  end if;
  return v;
end;
$$;

-- Lets the app check that a call really comes from the schedule below.
create or replace function public.dwp_bot_schedule_ok(p_token text, p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not dwp_bot.allowed(p_token) then
    raise exception 'akses ditolak' using errcode = '42501';
  end if;
  return exists (select 1 from dwp_bot.access a where a.id = 1 and a.tick_secret = p_secret);
end;
$$;

revoke all on function public.dwp_bot_read(text, text) from public, anon, authenticated;
revoke all on function public.dwp_bot_write(text, text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.dwp_bot_schedule_ok(text, text) from public, anon, authenticated;
grant execute on function public.dwp_bot_read(text, text) to anon;
grant execute on function public.dwp_bot_write(text, text, jsonb, bigint) to anon;
grant execute on function public.dwp_bot_schedule_ok(text, text) to anon;

-- The app's token (as a hash) and the schedule's own random key.
insert into dwp_bot.access (id, token_hash, tick_secret)
values (1, 'TOKEN_HASH_HERE', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do update set token_hash = excluded.token_hash;

-- ── Schedule: one bot check every 15 minutes ─────────────────────────────
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'dwp-bot-tick',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://autonomous-sooty.vercel.app/api/bot/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select a.tick_secret from dwp_bot.access a where a.id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

-- Make the new functions reachable through the Data API right away.
notify pgrst, 'reload schema';
