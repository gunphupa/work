-- Run once in a NEW Supabase project's SQL Editor. Re-running is safe.
-- Browser roles have no table writes or private-photo access: the Node API
-- verifies the Supabase user and controls every submission and decision.
begin;
create table if not exists public.community_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.community_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  target text not null check (length(target) between 1 and 80),
  kind text not null check (kind in ('comment','review')),
  name text not null check (length(trim(name)) between 2 and 60),
  body text not null check (length(trim(body)) between 10 and 3000),
  rating integer check (rating between 1 and 5),
  difficulty text check (difficulty in ('easy','moderate','hard')),
  outcome text check (outcome in ('worked','partly','not-yet')),
  photo_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  moderation_note text not null default '' check (length(moderation_note) <= 500),
  created_at timestamptz not null default now(),
  review_slot integer generated always as (case when kind='review' then 1 else null end) stored,
  unique(user_id,target,review_slot),
  check ((kind='review' and rating is not null) or (kind='comment' and rating is null and difficulty is null and outcome is null)),
  check (target <> 'website' or (kind='review' and difficulty is null and outcome is null and photo_path is null)),
  check (photo_path is null or photo_path = user_id::text || '/' || id::text || '.jpg')
);
create index if not exists community_public_feed on public.community_entries(target,kind,status,created_at desc,id desc);
create index if not exists community_owner_feed on public.community_entries(user_id,created_at desc,id desc);
create index if not exists community_queue on public.community_entries(status,created_at desc,id desc);
create table if not exists public.community_decisions (
  id bigint generated always as identity primary key,
  entry_id uuid references public.community_entries(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved','rejected')),
  note text not null check (length(note) <= 500),
  created_at timestamptz not null default now()
);
alter table public.community_moderators enable row level security;
alter table public.community_entries enable row level security;
alter table public.community_decisions enable row level security;
revoke all on public.community_moderators, public.community_entries, public.community_decisions from public, anon, authenticated;
grant all on public.community_moderators, public.community_entries, public.community_decisions to service_role;
grant usage, select on sequence public.community_decisions_id_seq to service_role;

create or replace function public.moderate_community_entry(entry_id uuid, actor_id uuid, decision text, note text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.community_moderators m where m.user_id=actor_id) then
    raise exception 'Moderator required';
  end if;
  if decision not in ('approved','rejected') or length(note)>500 then raise exception 'Invalid decision'; end if;
  update public.community_entries e set status=decision, moderation_note=note where e.id=entry_id;
  if not found then raise exception 'Entry missing'; end if;
  insert into public.community_decisions(entry_id,actor_id,decision,note)
    values(entry_id,actor_id,decision,note);
end;
$$;
revoke all on function public.moderate_community_entry(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.moderate_community_entry(uuid,uuid,text,text) to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('community-photos','community-photos',false,2097152,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
-- Also deny this bucket if the project has unrelated permissive storage policies.
drop policy if exists rebuild_private_photos on storage.objects;
create policy rebuild_private_photos on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'community-photos') with check (bucket_id <> 'community-photos');
commit;

-- After signing in yourself, find your UUID in Authentication > Users.
-- Replace the placeholder before running this separately:
-- insert into public.community_moderators(user_id) values ('YOUR-USER-UUID') on conflict do nothing;
