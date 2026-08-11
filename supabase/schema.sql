-- TeamSync Phase 4 schema
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.event_dates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint event_dates_time_order check (start_time < end_time),
  constraint event_dates_unique_date unique (event_id, event_date)
);

create index if not exists event_dates_event_id_idx
  on public.event_dates(event_id);

alter table public.events enable row level security;
alter table public.event_dates enable row level security;

-- The browser never writes tables directly. It can only call the validated RPC below.
revoke all on table public.events from anon, authenticated;
revoke all on table public.event_dates from anon, authenticated;

create or replace function public.create_event_with_dates(
  p_title text,
  p_description text,
  p_dates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_event_id uuid;
begin
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'イベント名は1〜80文字で入力してください。';
  end if;

  if p_description is not null and char_length(p_description) > 500 then
    raise exception '説明は500文字以内で入力してください。';
  end if;

  if p_dates is null or jsonb_typeof(p_dates) <> 'array' then
    raise exception '候補日時の形式が正しくありません。';
  end if;

  if jsonb_array_length(p_dates) not between 1 and 10 then
    raise exception '候補日時は1〜10件で指定してください。';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_dates) as item(
      event_date text,
      start_time text,
      end_time text
    )
    where item.event_date !~ '^\d{4}-\d{2}-\d{2}$'
       or item.start_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
       or item.end_time !~ '^(([01]\d|2[0-3]):[0-5]\d|24:00)$'
  ) then
    raise exception '候補日時の形式が正しくありません。';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_dates) as item(
      event_date text,
      start_time text,
      end_time text
    )
    where item.event_date::date < current_date
       or item.start_time::time >= item.end_time::time
  ) then
    raise exception '候補日は今日以降、終了時刻は開始時刻より後にしてください。';
  end if;

  if (
    select count(distinct item.event_date)
    from jsonb_to_recordset(p_dates) as item(event_date text)
  ) <> jsonb_array_length(p_dates) then
    raise exception '同じ候補日を重複して指定できません。';
  end if;

  insert into public.events (title, description)
  values (btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''))
  returning id into new_event_id;

  insert into public.event_dates (event_id, event_date, start_time, end_time)
  select
    new_event_id,
    item.event_date::date,
    item.start_time::time,
    item.end_time::time
  from jsonb_to_recordset(p_dates) as item(
    event_date text,
    start_time text,
    end_time text
  );

  return new_event_id;
end;
$$;

revoke all on function public.create_event_with_dates(text, text, jsonb)
  from public, authenticated;
grant usage on schema public to anon;
grant execute on function public.create_event_with_dates(text, text, jsonb) to anon;

comment on function public.create_event_with_dates(text, text, jsonb) is
  'Creates one TeamSync event and 1-10 candidate dates in a single transaction.';
