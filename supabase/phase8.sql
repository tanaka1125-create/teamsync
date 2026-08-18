-- TeamSync Phase 8: Chouseisan-style core feature migration.
-- Apply after schema.sql. Existing events stay editable with their current public model;
-- new events use organizer and participant capability tokens.

create extension if not exists pgcrypto;

alter table public.events add column if not exists organizer_token_hash text;
alter table public.events add column if not exists response_deadline timestamptz;
alter table public.events add column if not exists responses_protected boolean;
alter table public.events add column if not exists confirmed_event_date_id uuid;
alter table public.events add column if not exists updated_at timestamptz not null default now();

update public.events
set responses_protected = false
where responses_protected is null;

alter table public.events
  alter column responses_protected set default true,
  alter column responses_protected set not null;

alter table public.event_dates add column if not exists sort_order integer not null default 0;
alter table public.participants add column if not exists edit_token_hash text;
alter table public.participants add column if not exists sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (
    partition by event_id order by event_date, start_time, id
  ) - 1 as position
  from public.event_dates
)
update public.event_dates as candidate
set sort_order = ranked.position
from ranked
where candidate.id = ranked.id
  and candidate.sort_order = 0;

with ranked as (
  select id, row_number() over (
    partition by event_id order by name_key, created_at, id
  ) - 1 as position
  from public.participants
)
update public.participants as participant
set sort_order = ranked.position
from ranked
where participant.id = ranked.id
  and participant.sort_order = 0;

alter table public.event_dates
  drop constraint if exists event_dates_unique_date;
alter table public.event_dates
  add constraint event_dates_unique_date
  unique (event_id, event_date)
  deferrable initially deferred;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_confirmed_event_date_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_confirmed_event_date_id_fkey
      foreign key (confirmed_event_date_id)
      references public.event_dates(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists event_dates_event_sort_idx
  on public.event_dates(event_id, sort_order, event_date);
create index if not exists participants_event_sort_idx
  on public.participants(event_id, sort_order, created_at);
create index if not exists events_confirmed_event_date_id_idx
  on public.events(confirmed_event_date_id);

create or replace function public.create_event_with_dates_v2(
  p_title text,
  p_description text,
  p_dates jsonb,
  p_response_deadline timestamptz default null,
  p_responses_protected boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_event_id uuid;
  organizer_token text := encode(gen_random_bytes(24), 'hex');
begin
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'イベント名は1〜80文字で入力してください。';
  end if;
  if p_description is not null and char_length(p_description) > 500 then
    raise exception '説明は500文字以内で入力してください。';
  end if;
  if p_dates is null or jsonb_typeof(p_dates) <> 'array'
     or jsonb_array_length(p_dates) not between 1 and 30 then
    raise exception '候補日時は1〜30件で指定してください。';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_dates) as item(
      event_date text, start_time text, end_time text
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
      event_date text, start_time text, end_time text
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

  insert into public.events (
    title, description, organizer_token_hash, response_deadline, responses_protected
  )
  values (
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    encode(digest(organizer_token, 'sha256'), 'hex'),
    p_response_deadline,
    coalesce(p_responses_protected, true)
  )
  returning id into new_event_id;

  insert into public.event_dates (
    event_id, event_date, start_time, end_time, sort_order
  )
  select
    new_event_id,
    (item.value->>'event_date')::date,
    (item.value->>'start_time')::time,
    (item.value->>'end_time')::time,
    item.ordinality - 1
  from jsonb_array_elements(p_dates)
    with ordinality as item(value, ordinality);

  return jsonb_build_object(
    'eventId', new_event_id,
    'organizerToken', organizer_token
  );
end;
$$;

revoke all on function public.create_event_with_dates_v2(
  text, text, jsonb, timestamptz, boolean
) from public, authenticated;
grant execute on function public.create_event_with_dates_v2(
  text, text, jsonb, timestamptz, boolean
) to anon;

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
    'responseDeadline', event.response_deadline,
    'responsesProtected', event.responses_protected,
    'confirmedEventDateId', event.confirmed_event_date_id,
    'dates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', candidate.id,
          'eventDate', to_char(candidate.event_date, 'YYYY-MM-DD'),
          'startTime', to_char(candidate.start_time, 'HH24:MI'),
          'endTime', to_char(candidate.end_time, 'HH24:MI'),
          'sortOrder', candidate.sort_order
        )
        order by candidate.sort_order, candidate.event_date, candidate.start_time, candidate.id
      )
      from public.event_dates as candidate
      where candidate.event_id = event.id
    ), '[]'::jsonb)
  )
  from public.events as event
  where event.id = p_event_id;
$$;

revoke all on function public.get_event_details(uuid)
  from public, authenticated;
grant execute on function public.get_event_details(uuid) to anon;

create or replace function public.get_event_results(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'participantCount', (
      select count(*) from public.participants
      where event_id = event.id
    ),
    'responsesProtected', event.responses_protected,
    'responseDeadline', event.response_deadline,
    'confirmedEventDateId', event.confirmed_event_date_id,
    'counts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'eventDateId', candidate.id,
          'yesCount', totals.yes_count,
          'maybeCount', totals.maybe_count,
          'noCount', totals.no_count,
          'unansweredCount', greatest((
            select count(*) from public.participants
            where event_id = event.id
          ) - totals.response_count, 0),
          'score', totals.yes_count + (totals.maybe_count * 0.5)
        )
        order by candidate.sort_order, candidate.event_date, candidate.start_time, candidate.id
      )
      from public.event_dates as candidate
      left join lateral (
        select
          count(*) filter (where response.status = 'yes') as yes_count,
          count(*) filter (where response.status = 'maybe') as maybe_count,
          count(*) filter (where response.status = 'no') as no_count,
          count(*) as response_count
        from public.responses as response
        join public.participants as participant
          on participant.id = response.participant_id
         and participant.event_id = event.id
        where response.event_date_id = candidate.id
      ) as totals on true
      where candidate.event_id = event.id
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', participant.id,
          'name', participant.name,
          'sortOrder', participant.sort_order,
          'responses', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'eventDateId', response.event_date_id,
                'status', response.status,
                'comment', response.comment
              )
              order by candidate.sort_order, candidate.event_date, candidate.id
            )
            from public.responses as response
            join public.event_dates as candidate
              on candidate.id = response.event_date_id
             and candidate.event_id = event.id
            where response.participant_id = participant.id
          ), '[]'::jsonb)
        )
        order by participant.sort_order, participant.created_at, participant.id
      )
      from public.participants as participant
      where participant.event_id = event.id
    ), '[]'::jsonb)
  )
  from public.events as event
  where event.id = p_event_id;
$$;

revoke all on function public.get_event_results(uuid)
  from public, authenticated;
grant execute on function public.get_event_results(uuid) to anon;

create or replace function public.submit_event_responses(
  p_event_id uuid,
  p_name text,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  saved_participant_id uuid;
  saved_response_count integer;
  participant_token text := encode(gen_random_bytes(24), 'hex');
  deadline timestamptz;
  next_order integer;
begin
  select event.response_deadline into deadline
  from public.events as event
  where event.id = p_event_id;
  if not found then
    raise exception 'イベントが見つかりません。';
  end if;
  if deadline is not null and now() > deadline then
    raise exception 'RESPONSE_DEADLINE_PASSED';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception '名前は1〜40文字で入力してください。';
  end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'array'
     or jsonb_array_length(p_responses) not between 1 and 30 then
    raise exception '回答は1〜30件で指定してください。';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_responses) as item(
      event_date_id text, status text, comment text
    )
    where item.event_date_id is null
       or item.event_date_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.participants
  where event_id = p_event_id;

  begin
    insert into public.participants (
      event_id, name, edit_token_hash, sort_order
    )
    values (
      p_event_id,
      btrim(p_name),
      encode(digest(participant_token, 'sha256'), 'hex'),
      next_order
    )
    returning id into saved_participant_id;
  exception when unique_violation then
    raise exception 'PARTICIPANT_NAME_EXISTS';
  end;

  insert into public.responses (
    participant_id, event_date_id, status, comment
  )
  select
    saved_participant_id,
    item.event_date_id::uuid,
    item.status,
    nullif(btrim(coalesce(item.comment, '')), '')
  from jsonb_to_recordset(p_responses) as item(
    event_date_id text, status text, comment text
  );
  get diagnostics saved_response_count = row_count;

  return jsonb_build_object(
    'participantId', saved_participant_id,
    'participantToken', participant_token,
    'savedCount', saved_response_count
  );
end;
$$;

revoke all on function public.submit_event_responses(uuid, text, jsonb)
  from public, authenticated;
grant execute on function public.submit_event_responses(uuid, text, jsonb) to anon;

create or replace function public.update_event_responses_v2(
  p_event_id uuid,
  p_participant_id uuid,
  p_name text,
  p_edit_token text,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  protected boolean;
  deadline timestamptz;
  stored_hash text;
  saved_response_count integer;
begin
  select event.responses_protected, event.response_deadline, participant.edit_token_hash
  into protected, deadline, stored_hash
  from public.participants as participant
  join public.events as event on event.id = participant.event_id
  where participant.id = p_participant_id
    and participant.event_id = p_event_id;
  if not found then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if deadline is not null and now() > deadline then
    raise exception 'RESPONSE_DEADLINE_PASSED';
  end if;
  if protected and (
    p_edit_token is null
    or stored_hash is null
    or stored_hash <> encode(digest(p_edit_token, 'sha256'), 'hex')
  ) then
    raise exception 'RESPONSE_EDIT_FORBIDDEN';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception '名前は1〜40文字で入力してください。';
  end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'array'
     or jsonb_array_length(p_responses) not between 1 and 30 then
    raise exception '回答は1〜30件で指定してください。';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_responses) as item(
      event_date_id text, status text, comment text
    )
    where item.event_date_id is null
       or item.event_date_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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

  begin
    update public.participants
    set name = btrim(p_name)
    where id = p_participant_id;
  exception when unique_violation then
    raise exception 'PARTICIPANT_NAME_EXISTS';
  end;

  delete from public.responses where participant_id = p_participant_id;
  insert into public.responses (
    participant_id, event_date_id, status, comment
  )
  select
    p_participant_id,
    item.event_date_id::uuid,
    item.status,
    nullif(btrim(coalesce(item.comment, '')), '')
  from jsonb_to_recordset(p_responses) as item(
    event_date_id text, status text, comment text
  );
  get diagnostics saved_response_count = row_count;

  return jsonb_build_object(
    'participantId', p_participant_id,
    'savedCount', saved_response_count
  );
end;
$$;

revoke all on function public.update_event_responses_v2(
  uuid, uuid, text, text, jsonb
) from public, authenticated;
grant execute on function public.update_event_responses_v2(
  uuid, uuid, text, text, jsonb
) to anon;

revoke execute on function public.update_event_responses(uuid, uuid, jsonb)
  from anon, authenticated, public;
revoke execute on function public.delete_event_participant(uuid, uuid)
  from anon, authenticated, public;

create or replace function public.get_event_admin_details(
  p_event_id uuid,
  p_admin_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stored_hash text;
begin
  select organizer_token_hash into stored_hash
  from public.events where id = p_event_id;
  if stored_hash is null
     or p_admin_token is null
     or stored_hash <> encode(digest(p_admin_token, 'sha256'), 'hex') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  return public.get_event_details(p_event_id);
end;
$$;

revoke all on function public.get_event_admin_details(uuid, text)
  from public, authenticated;
grant execute on function public.get_event_admin_details(uuid, text) to anon;

create or replace function public.update_event_settings(
  p_event_id uuid,
  p_admin_token text,
  p_title text,
  p_description text,
  p_response_deadline timestamptz,
  p_responses_protected boolean,
  p_dates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stored_hash text;
  item record;
begin
  select organizer_token_hash into stored_hash
  from public.events where id = p_event_id;
  if stored_hash is null
     or p_admin_token is null
     or stored_hash <> encode(digest(p_admin_token, 'sha256'), 'hex') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'イベント名は1〜80文字で入力してください。';
  end if;
  if p_description is not null and char_length(p_description) > 500 then
    raise exception '説明は500文字以内で入力してください。';
  end if;
  if p_dates is null or jsonb_typeof(p_dates) <> 'array'
     or jsonb_array_length(p_dates) not between 1 and 30 then
    raise exception '候補日時は1〜30件で指定してください。';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_dates) as row_data(
      id text, event_date text, start_time text, end_time text
    )
    where (row_data.id is not null and row_data.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       or row_data.event_date !~ '^\d{4}-\d{2}-\d{2}$'
       or row_data.start_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
       or row_data.end_time !~ '^(([01]\d|2[0-3]):[0-5]\d|24:00)$'
       or row_data.start_time::time >= row_data.end_time::time
  ) then
    raise exception '候補日時の形式が正しくありません。';
  end if;
  if (
    select count(distinct row_data.event_date)
    from jsonb_to_recordset(p_dates) as row_data(event_date text)
  ) <> jsonb_array_length(p_dates) then
    raise exception '同じ候補日を重複して指定できません。';
  end if;
  if (
    select count(distinct row_data.id)
    from jsonb_to_recordset(p_dates) as row_data(id text)
    where row_data.id is not null
  ) <> (
    select count(*)
    from jsonb_to_recordset(p_dates) as row_data(id text)
    where row_data.id is not null
  ) then
    raise exception '候補日時IDが重複しています。';
  end if;

  set constraints event_dates_unique_date deferred;

  delete from public.event_dates as candidate
  where candidate.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_dates) as row_data(id text)
      where row_data.id is not null
        and row_data.id::uuid = candidate.id
    );

  for item in
    select
      row_data.value->>'id' as id,
      row_data.value->>'event_date' as event_date,
      row_data.value->>'start_time' as start_time,
      row_data.value->>'end_time' as end_time,
      row_data.ordinality
    from jsonb_array_elements(p_dates)
      with ordinality as row_data(value, ordinality)
  loop
    if item.id is null then
      insert into public.event_dates(
        event_id, event_date, start_time, end_time, sort_order
      ) values (
        p_event_id,
        item.event_date::date,
        item.start_time::time,
        item.end_time::time,
        item.ordinality - 1
      );
    else
      update public.event_dates
      set event_date = item.event_date::date,
          start_time = item.start_time::time,
          end_time = item.end_time::time,
          sort_order = item.ordinality - 1
      where id = item.id::uuid
        and event_id = p_event_id;
      if not found then
        raise exception 'イベントに含まれない候補日時です。';
      end if;
    end if;
  end loop;

  update public.events
  set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      response_deadline = p_response_deadline,
      responses_protected = coalesce(p_responses_protected, true),
      updated_at = now()
  where id = p_event_id;

  return public.get_event_details(p_event_id);
end;
$$;

revoke all on function public.update_event_settings(
  uuid, text, text, text, timestamptz, boolean, jsonb
) from public, authenticated;
grant execute on function public.update_event_settings(
  uuid, text, text, text, timestamptz, boolean, jsonb
) to anon;

create or replace function public.admin_set_confirmed_date(
  p_event_id uuid,
  p_admin_token text,
  p_event_date_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stored_hash text;
begin
  select organizer_token_hash into stored_hash
  from public.events where id = p_event_id;
  if stored_hash is null
     or p_admin_token is null
     or stored_hash <> encode(digest(p_admin_token, 'sha256'), 'hex') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  if p_event_date_id is not null and not exists (
    select 1 from public.event_dates
    where id = p_event_date_id and event_id = p_event_id
  ) then
    raise exception 'イベントに含まれない候補日時です。';
  end if;
  update public.events
  set confirmed_event_date_id = p_event_date_id,
      updated_at = now()
  where id = p_event_id;
  return public.get_event_details(p_event_id);
end;
$$;

revoke all on function public.admin_set_confirmed_date(uuid, text, uuid)
  from public, authenticated;
grant execute on function public.admin_set_confirmed_date(uuid, text, uuid) to anon;

create or replace function public.admin_reorder_participants(
  p_event_id uuid,
  p_admin_token text,
  p_participant_ids jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stored_hash text;
begin
  select organizer_token_hash into stored_hash
  from public.events where id = p_event_id;
  if stored_hash is null
     or p_admin_token is null
     or stored_hash <> encode(digest(p_admin_token, 'sha256'), 'hex') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  if p_participant_ids is null or jsonb_typeof(p_participant_ids) <> 'array' then
    raise exception '参加者の並び順が正しくありません。';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_participant_ids) as item(id)
    left join public.participants as participant
      on participant.id = item.id::uuid
     and participant.event_id = p_event_id
    where participant.id is null
  ) then
    raise exception 'イベントに含まれない参加者です。';
  end if;
  update public.participants as participant
  set sort_order = ordering.position - 1
  from (
    select item.id::uuid as id, item.ordinality as position
    from jsonb_array_elements_text(p_participant_ids)
      with ordinality as item(id, ordinality)
  ) as ordering
  where participant.id = ordering.id
    and participant.event_id = p_event_id;
  return true;
end;
$$;

revoke all on function public.admin_reorder_participants(uuid, text, jsonb)
  from public, authenticated;
grant execute on function public.admin_reorder_participants(uuid, text, jsonb) to anon;

create or replace function public.admin_delete_participant(
  p_event_id uuid,
  p_admin_token text,
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stored_hash text;
begin
  select organizer_token_hash into stored_hash
  from public.events where id = p_event_id;
  if stored_hash is null
     or p_admin_token is null
     or stored_hash <> encode(digest(p_admin_token, 'sha256'), 'hex') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  delete from public.participants
  where id = p_participant_id and event_id = p_event_id;
  if not found then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_delete_participant(uuid, text, uuid)
  from public, authenticated;
grant execute on function public.admin_delete_participant(uuid, text, uuid) to anon;

create or replace function public.admin_delete_event(
  p_event_id uuid,
  p_admin_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stored_hash text;
begin
  select organizer_token_hash into stored_hash
  from public.events where id = p_event_id;
  if stored_hash is null
     or p_admin_token is null
     or stored_hash <> encode(digest(p_admin_token, 'sha256'), 'hex') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  delete from public.events where id = p_event_id;
  return true;
end;
$$;

revoke all on function public.admin_delete_event(uuid, text)
  from public, authenticated;
grant execute on function public.admin_delete_event(uuid, text) to anon;
