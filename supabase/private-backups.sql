-- Optional manual account backup. Run once in the Supabase SQL editor.
-- No existing inventory, community, research data or policies are modified.
begin;

create table if not exists public.rebuild_private_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  payload jsonb not null,
  constraint rebuild_backup_size check (octet_length(payload::text) <= 2000000),
  constraint rebuild_backup_shape check (coalesce(
    jsonb_typeof(payload) = 'object'
    and payload->>'version' = '1'
    and jsonb_typeof(payload->'inventory') = 'array'
    and jsonb_typeof(payload->'builds') = 'array'
    and (payload - array['version','inventory','builds']) = '{}'::jsonb,
    false
  )),
  constraint rebuild_backup_counts check (
    case when jsonb_typeof(payload->'inventory') = 'array'
      and jsonb_typeof(payload->'builds') = 'array'
    then jsonb_array_length(payload->'inventory') <= 500
      and jsonb_array_length(payload->'builds') <= 100
    else false end
  )
);
alter table public.rebuild_private_backups enable row level security;
revoke all on public.rebuild_private_backups from public, anon, authenticated;
grant select on public.rebuild_private_backups to authenticated;
drop policy if exists rebuild_backup_owner_read on public.rebuild_private_backups;
create policy rebuild_backup_owner_read on public.rebuild_private_backups
  for select to authenticated using (user_id = (select auth.uid()));
-- Restrictive policy also protects reads if a future unrelated permissive
-- policy is accidentally added. Browser roles never receive direct writes.
drop policy if exists rebuild_backup_owner_guard on public.rebuild_private_backups;
create policy rebuild_backup_owner_guard on public.rebuild_private_backups
  as restrictive for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Remove pre-actor-binding overloads if a previous draft was installed.
drop function if exists public.save_rebuild_backup(jsonb,uuid);
drop function if exists public.delete_rebuild_backup(uuid);
create or replace function public.save_rebuild_backup(
  expected_user_id uuid,
  new_payload jsonb,
  expected_revision uuid default null
) returns table(revision uuid, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if actor is distinct from expected_user_id then
    raise exception 'Account changed: sign in and retry' using errcode='28000';
  end if;
  if new_payload is null or octet_length(new_payload::text) > 2000000 then
    raise exception 'Invalid backup' using errcode='22023';
  end if;
  if expected_revision is null then
    return query insert into public.rebuild_private_backups as b(user_id, payload)
      values(actor, new_payload)
      on conflict (user_id) do nothing
      returning b.revision, b.updated_at;
  else
    return query update public.rebuild_private_backups as b
      set payload = new_payload, revision = gen_random_uuid(), updated_at = now()
      where b.user_id = actor and b.revision = expected_revision
      returning b.revision, b.updated_at;
  end if;
  if not found then
    raise exception 'Backup changed: refresh before saving' using errcode='40001';
  end if;
end;
$$;

create or replace function public.delete_rebuild_backup(expected_user_id uuid, expected_revision uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if actor is distinct from expected_user_id then
    raise exception 'Account changed: sign in and retry' using errcode='28000';
  end if;
  delete from public.rebuild_private_backups as b
    where b.user_id=actor and b.revision=expected_revision;
  if not found then
    raise exception 'Backup changed: refresh before deleting' using errcode='40001';
  end if;
  return true;
end;
$$;
revoke all on function public.save_rebuild_backup(uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.delete_rebuild_backup(uuid,uuid) from public, anon, authenticated;
grant execute on function public.save_rebuild_backup(uuid,jsonb,uuid) to authenticated;
grant execute on function public.delete_rebuild_backup(uuid,uuid) to authenticated;
commit;
