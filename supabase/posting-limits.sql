-- Run in Supabase SQL Editor BEFORE deploying the posting-limit update.
-- Repeatable. Does not modify accounts, posts, reviews, or photos.
begin;
create table if not exists public.community_submission_limits (
  quota_day date not null,
  bucket text not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (quota_day, bucket)
);
alter table public.community_submission_limits enable row level security;
revoke all on public.community_submission_limits from public, anon, authenticated;
grant select, insert, update, delete on public.community_submission_limits to service_role;

create or replace function public.take_community_submission(actor_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  today date := (statement_timestamp() at time zone 'UTC')::date;
  total integer;
  personal integer;
begin
  if actor_id is null then raise exception 'User required'; end if;
  -- The shared row lock serializes attempts from ALL server instances.
  -- Both counters change in one transaction or neither changes.
  insert into public.community_submission_limits(quota_day,bucket)
    values(today,'global') on conflict do nothing;
  select attempts into total from public.community_submission_limits
    where quota_day=today and bucket='global' for update;
  delete from public.community_submission_limits where quota_day < today;
  select attempts into personal from public.community_submission_limits
    where quota_day=today and bucket=actor_id::text;
  if total >= 100 or coalesce(personal,0) >= 10 then return false; end if;
  insert into public.community_submission_limits(quota_day,bucket,attempts)
    values(today,actor_id::text,1)
    on conflict(quota_day,bucket) do update
      set attempts=public.community_submission_limits.attempts+1;
  update public.community_submission_limits set attempts=attempts+1
    where quota_day=today and bucket='global';
  return true;
end;
$$;
revoke all on function public.take_community_submission(uuid) from public, anon, authenticated;
grant execute on function public.take_community_submission(uuid) to service_role;
commit;
