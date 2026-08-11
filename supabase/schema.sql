-- TeamSync Phase 6 schema
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

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  name_key text generated always as (lower(btrim(name))) stored,
  created_at timestamptz not null default now(),
  constraint participants_unique_name unique (event_id, name_key)
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  event_date_id uuid not null references public.event_dates(id) on delete cascade,
  status text not null check (status in ('yes', 'maybe', 'no')),
  comment text check (comment is null or char_length(comment) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint responses_unique_candidate unique (participant_id, event_date_id)
);

create index if not exists participants_event_id_idx
  on public.participants(event_id);

create index if not exists responses_event_date_id_idx
  on public.responses(event_date_id);

alter table public.events enable row level security;
alter table public.event_dates enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;

-- The browser never writes tables directly. It can only call the validated RPC below.
revoke all on table public.events from anon, authenticated;
revoke all on table public.event_dates from anon, authenticated;
revoke all on table public.participants from anon, authenticated;
revoke all on table public.responses from anon, authenticated;

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

-- Only the fields required by the public event page are returned.
-- Direct table access remains revoked.
create or replace function public.get_event_details(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', event.id,
    'title', event.title,
    'description', event.description,
    'dates', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', candidate.id,
            'eventDate', to_char(candidate.event_date, 'YYYY-MM-DD'),
            'startTime', to_char(candidate.start_time, 'HH24:MI'),
            'endTime', to_char(candidate.end_time, 'HH24:MI')
          )
          order by candidate.event_date, candidate.start_time, candidate.id
        )
        from public.event_dates as candidate
        where candidate.event_id = event.id
      ),
      '[]'::jsonb
    )
  )
  from public.events as event
  where event.id = p_event_id;
$$;

revoke all on function public.get_event_details(uuid)
  from public, authenticated;
grant execute on function public.get_event_details(uuid) to anon;

comment on function public.get_event_details(uuid) is
  'Returns the public TeamSync event fields for a URL-scoped event ID.';

create or replace function public.submit_event_responses(
  p_event_id uuid,
  p_name text,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_participant_id uuid;
  saved_response_count integer;
begin
  if not exists (
    select 1
    from public.events as event
    where event.id = p_event_id
  ) then
    raise exception 'イベントが見つかりません。';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception '名前は1〜40文字で入力してください。';
  end if;

  if p_responses is null or jsonb_typeof(p_responses) <> 'array' then
    raise exception '回答の形式が正しくありません。';
  end if;

  if jsonb_array_length(p_responses) not between 1 and 10 then
    raise exception '回答は1〜10件で指定してください。';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_responses) as item(
      event_date_id text,
      status text,
      comment text
    )
    where item.event_date_id is null
       or item.event_date_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or item.status is null
       or item.status not in ('yes', 'maybe', 'no')
       or char_length(coalesce(item.comment, '')) > 200
  ) then
    raise exception '回答の内容が正しくありません。';
  end if;

  if (
    select count(distinct item.event_date_id)
    from jsonb_to_recordset(p_responses) as item(event_date_id text)
  ) <> jsonb_array_length(p_responses) then
    raise exception '同じ候補日時へ重複して回答できません。';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_responses) as item(event_date_id text)
    left join public.event_dates as candidate
      on candidate.id = item.event_date_id::uuid
     and candidate.event_id = p_event_id
    where candidate.id is null
  ) then
    raise exception 'イベントに含まれない候補日時には回答できません。';
  end if;

  insert into public.participants (event_id, name)
  values (p_event_id, btrim(p_name))
  on conflict (event_id, name_key)
  do update set name = excluded.name
  returning id into saved_participant_id;

  insert into public.responses (
    participant_id,
    event_date_id,
    status,
    comment
  )
  select
    saved_participant_id,
    item.event_date_id::uuid,
    item.status,
    nullif(btrim(coalesce(item.comment, '')), '')
  from jsonb_to_recordset(p_responses) as item(
    event_date_id text,
    status text,
    comment text
  )
  on conflict (participant_id, event_date_id)
  do update set
    status = excluded.status,
    comment = excluded.comment,
    updated_at = now();

  get diagnostics saved_response_count = row_count;

  return jsonb_build_object(
    'participantId', saved_participant_id,
    'savedCount', saved_response_count
  );
end;
$$;

revoke all on function public.submit_event_responses(uuid, text, jsonb)
  from public, authenticated;
grant execute on function public.submit_event_responses(uuid, text, jsonb) to anon;

comment on function public.submit_event_responses(uuid, text, jsonb) is
  'Creates or updates the selected TeamSync responses for a participant name.';
