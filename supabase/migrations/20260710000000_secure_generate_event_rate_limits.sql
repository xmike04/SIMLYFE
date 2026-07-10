create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.generate_event_rate_limits (
  user_key text primary key,
  tokens numeric(8, 4) not null default 2,
  tokens_updated_at timestamptz not null default clock_timestamp(),
  day_window date not null default (timezone('UTC', clock_timestamp()))::date,
  day_count integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  constraint generate_event_rate_limits_user_key_format
    check (user_key ~ '^[0-9a-f]{64}$'),
  constraint generate_event_rate_limits_tokens_range
    check (tokens >= 0 and tokens <= 2),
  constraint generate_event_rate_limits_day_count_range
    check (day_count >= 0 and day_count <= 100)
);

create index if not exists generate_event_rate_limits_updated_at_idx
  on private.generate_event_rate_limits (updated_at);

create table if not exists private.generate_event_project_quota (
  singleton boolean primary key default true,
  day_window date not null default (timezone('UTC', clock_timestamp()))::date,
  day_count integer not null default 0,
  last_pruned_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint generate_event_project_quota_singleton
    check (singleton),
  constraint generate_event_project_quota_day_count_range
    check (day_count >= 0 and day_count <= 100000)
);

insert into private.generate_event_project_quota (singleton)
values (true)
on conflict (singleton) do nothing;

alter table private.generate_event_rate_limits enable row level security;
alter table private.generate_event_rate_limits force row level security;
alter table private.generate_event_project_quota enable row level security;
alter table private.generate_event_project_quota force row level security;

revoke all on table private.generate_event_rate_limits from public, anon, authenticated;
revoke all on table private.generate_event_project_quota from public, anon, authenticated;

create or replace function public.consume_generate_event_quota(
  p_user_key text,
  p_project_daily_limit integer
)
returns table (
  allowed boolean,
  remaining_burst integer,
  remaining_day integer,
  remaining_project_day integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, private
set timezone = 'UTC'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day date := (timezone('UTC', v_now))::date;
  v_project_row private.generate_event_project_quota%rowtype;
  v_user_row private.generate_event_rate_limits%rowtype;
  v_project_count integer;
  v_tokens numeric(8, 4);
  v_user_day_count integer;
  v_last_pruned_at timestamptz;
begin
  if p_user_key is null or p_user_key !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid user key';
  end if;
  if p_project_daily_limit is null or p_project_daily_limit < 100 or p_project_daily_limit > 100000 then
    raise exception using errcode = '22023', message = 'invalid project daily limit';
  end if;

  insert into private.generate_event_project_quota (singleton)
  values (true)
  on conflict (singleton) do nothing;

  -- The singleton is always locked before any per-user row. This both makes the
  -- project circuit breaker atomic and gives every caller the same lock order.
  select *
  into v_project_row
  from private.generate_event_project_quota
  where singleton = true
  for update;

  v_project_count := case when v_project_row.day_window = v_day then v_project_row.day_count else 0 end;
  v_last_pruned_at := v_project_row.last_pruned_at;

  -- The updated_at index keeps this daily retention pass bounded to stale rows.
  -- The singleton lock and timestamp ensure concurrent requests cannot repeat it.
  if v_last_pruned_at <= v_now - interval '1 day' then
    delete from private.generate_event_rate_limits
    where updated_at < v_now - interval '7 days';
    v_last_pruned_at := v_now;
  end if;

  update private.generate_event_project_quota
  set day_window = v_day,
      day_count = v_project_count,
      last_pruned_at = v_last_pruned_at,
      updated_at = v_now
  where singleton = true;

  if v_project_count >= p_project_daily_limit then
    return query select
      false,
      0,
      0,
      0,
      greatest(1, ceil(extract(epoch from (((v_day + 1)::timestamp at time zone 'UTC') - v_now)))::integer);
    return;
  end if;

  insert into private.generate_event_rate_limits (user_key, tokens, tokens_updated_at, day_window, day_count, updated_at)
  values (p_user_key, 2, v_now, v_day, 0, v_now)
  on conflict (user_key) do nothing;

  select *
  into v_user_row
  from private.generate_event_rate_limits
  where user_key = p_user_key
  for update;

  v_tokens := least(
    2::numeric,
    v_user_row.tokens + greatest(0, extract(epoch from (v_now - v_user_row.tokens_updated_at))) * 0.1
  );
  v_user_day_count := case when v_user_row.day_window = v_day then v_user_row.day_count else 0 end;

  if v_tokens < 1 or v_user_day_count >= 100 then
    update private.generate_event_rate_limits
    set tokens = v_tokens,
        tokens_updated_at = v_now,
        day_window = v_day,
        day_count = v_user_day_count,
        updated_at = v_now
    where user_key = p_user_key;

    return query select
      false,
      floor(v_tokens)::integer,
      greatest(0, 100 - v_user_day_count),
      greatest(0, p_project_daily_limit - v_project_count),
      case
        when v_user_day_count >= 100 then greatest(
          1,
          ceil(extract(epoch from (((v_day + 1)::timestamp at time zone 'UTC') - v_now)))::integer
        )
        else greatest(1, ceil((1 - v_tokens) / 0.1)::integer)
      end;
    return;
  end if;

  v_tokens := v_tokens - 1;
  v_user_day_count := v_user_day_count + 1;
  v_project_count := v_project_count + 1;

  update private.generate_event_rate_limits
  set tokens = v_tokens,
      tokens_updated_at = v_now,
      day_window = v_day,
      day_count = v_user_day_count,
      updated_at = v_now
  where user_key = p_user_key;

  update private.generate_event_project_quota
  set day_window = v_day,
      day_count = v_project_count,
      last_pruned_at = v_last_pruned_at,
      updated_at = v_now
  where singleton = true;

  return query select
    true,
    floor(v_tokens)::integer,
    greatest(0, 100 - v_user_day_count),
    greatest(0, p_project_daily_limit - v_project_count),
    0;
end;
$$;

revoke all on function public.consume_generate_event_quota(text, integer) from public;
revoke all on function public.consume_generate_event_quota(text, integer) from anon, authenticated;
grant execute on function public.consume_generate_event_quota(text, integer) to service_role;

comment on table private.generate_event_rate_limits is
  'Per-user generate-event token buckets. Rows inactive for seven days are pruned at most once daily.';
comment on table private.generate_event_project_quota is
  'Singleton project-wide daily generation circuit breaker and pruning coordinator.';
comment on function public.consume_generate_event_quota(text, integer) is
  'Atomically enforces per-user 6/minute sustained, burst 2, 100/day, plus a configurable project-wide daily cap.';
