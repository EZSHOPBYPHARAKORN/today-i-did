begin;

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null default gen_random_uuid(),
  classroom_id uuid references public.classrooms(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  assignee_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'submitted', 'completed')),
  progress smallint not null default 0 check (progress between 0 and 100),
  submission_text text not null default '' check (char_length(submission_text) <= 1000),
  points smallint not null default 10 check (points between 0 and 1000),
  awarded_points smallint not null default 0 check (awarded_points between 0 and 1000),
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classroom_members_user_idx on public.classroom_members (user_id);
create index missions_assignee_idx on public.missions (assignee_id, due_at);
create index missions_creator_idx on public.missions (creator_id, created_at desc);
create index missions_template_idx on public.missions (template_id);

alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.missions enable row level security;

create or replace function public.is_classroom_member(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classroom_members
    where classroom_id = target_classroom and user_id = auth.uid()
  );
$$;

create or replace function public.is_classroom_owner(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classrooms
    where id = target_classroom and owner_id = auth.uid()
  );
$$;

create policy "Members can view their classrooms"
  on public.classrooms for select to authenticated
  using (public.is_classroom_member(id));

create policy "Members can view classroom rosters"
  on public.classroom_members for select to authenticated
  using (public.is_classroom_member(classroom_id));

create policy "Creators and assignees can view missions"
  on public.missions for select to authenticated
  using (creator_id = (select auth.uid()) or assignee_id = (select auth.uid()));

create or replace function public.create_classroom(classroom_name text, classroom_description text default '')
returns public.classrooms
language plpgsql
security definer
set search_path = public
as $$
declare new_classroom public.classrooms;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.classrooms (owner_id, name, description)
  values (auth.uid(), btrim(classroom_name), coalesce(classroom_description, ''))
  returning * into new_classroom;
  insert into public.classroom_members (classroom_id, user_id, role)
  values (new_classroom.id, auth.uid(), 'owner');
  return new_classroom;
end;
$$;

create or replace function public.join_classroom(classroom_code text)
returns public.classrooms
language plpgsql
security definer
set search_path = public
as $$
declare target public.classrooms;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into target from public.classrooms
  where invite_code = upper(btrim(classroom_code));
  if target.id is null then raise exception 'Invite code not found'; end if;
  insert into public.classroom_members (classroom_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (classroom_id, user_id) do nothing;
  return target;
end;
$$;

create or replace function public.create_personal_mission(
  mission_title text,
  mission_description text default '',
  mission_due_at timestamptz default null,
  mission_points integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.missions (creator_id, assignee_id, title, description, due_at, points)
  values (auth.uid(), auth.uid(), btrim(mission_title), coalesce(mission_description, ''), mission_due_at, mission_points)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.create_classroom_mission(
  target_classroom uuid,
  mission_title text,
  mission_description text default '',
  mission_due_at timestamptz default null,
  mission_points integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare batch_id uuid := gen_random_uuid(); created_count integer;
begin
  if not public.is_classroom_owner(target_classroom) then raise exception 'Owner access required'; end if;
  insert into public.missions (template_id, classroom_id, creator_id, assignee_id, title, description, due_at, points)
  select batch_id, target_classroom, auth.uid(), user_id, btrim(mission_title), coalesce(mission_description, ''), mission_due_at, mission_points
  from public.classroom_members
  where classroom_id = target_classroom and role = 'member';
  get diagnostics created_count = row_count;
  if created_count = 0 then raise exception 'This classroom has no members yet'; end if;
  return created_count;
end;
$$;

create or replace function public.save_mission_progress(
  target_mission uuid,
  new_progress integer,
  new_submission text default '',
  submit_now boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare item public.missions;
begin
  select * into item from public.missions where id = target_mission;
  if item.assignee_id is distinct from auth.uid() then raise exception 'Assignee access required'; end if;
  update public.missions set
    progress = greatest(0, least(100, new_progress)),
    submission_text = coalesce(new_submission, ''),
    status = case
      when submit_now and classroom_id is null then 'completed'
      when submit_now then 'submitted'
      when new_progress > 0 then 'in_progress'
      else 'todo'
    end,
    submitted_at = case when submit_now then now() else submitted_at end,
    completed_at = case when submit_now and classroom_id is null then now() else completed_at end,
    awarded_points = case when submit_now and classroom_id is null then points else awarded_points end,
    updated_at = now()
  where id = target_mission;
end;
$$;

create or replace function public.review_mission(target_mission uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare item public.missions;
begin
  select * into item from public.missions where id = target_mission;
  if item.creator_id is distinct from auth.uid() or item.classroom_id is null then raise exception 'Creator access required'; end if;
  if item.status <> 'submitted' then raise exception 'Mission is not submitted'; end if;
  update public.missions set
    status = case when approve then 'completed' else 'in_progress' end,
    progress = case when approve then 100 else progress end,
    awarded_points = case when approve then points else 0 end,
    completed_at = case when approve then now() else null end,
    updated_at = now()
  where id = target_mission;
end;
$$;

create or replace function public.delete_mission_batch(target_template uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.missions where template_id = target_template and creator_id = auth.uid()) then
    raise exception 'Creator access required';
  end if;
  delete from public.missions where template_id = target_template and creator_id = auth.uid();
end;
$$;

create or replace function public.leave_classroom(target_classroom uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_classroom_owner(target_classroom) then raise exception 'Owners cannot leave their classroom'; end if;
  delete from public.classroom_members where classroom_id = target_classroom and user_id = auth.uid();
end;
$$;

revoke all on public.classrooms, public.classroom_members, public.missions from anon, authenticated;
grant select on public.classrooms, public.classroom_members, public.missions to authenticated;
revoke all on function public.is_classroom_member(uuid) from public, anon, authenticated;
revoke all on function public.is_classroom_owner(uuid) from public, anon, authenticated;
revoke all on function public.create_classroom(text, text) from public, anon, authenticated;
revoke all on function public.join_classroom(text) from public, anon, authenticated;
revoke all on function public.create_personal_mission(text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.create_classroom_mission(uuid, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.save_mission_progress(uuid, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.review_mission(uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_mission_batch(uuid) from public, anon, authenticated;
revoke all on function public.leave_classroom(uuid) from public, anon, authenticated;
grant execute on function public.create_classroom(text, text) to authenticated;
grant execute on function public.is_classroom_member(uuid) to authenticated;
grant execute on function public.is_classroom_owner(uuid) to authenticated;
grant execute on function public.join_classroom(text) to authenticated;
grant execute on function public.create_personal_mission(text, text, timestamptz, integer) to authenticated;
grant execute on function public.create_classroom_mission(uuid, text, text, timestamptz, integer) to authenticated;
grant execute on function public.save_mission_progress(uuid, integer, text, boolean) to authenticated;
grant execute on function public.review_mission(uuid, boolean) to authenticated;
grant execute on function public.delete_mission_batch(uuid) to authenticated;
grant execute on function public.leave_classroom(uuid) to authenticated;

commit;
