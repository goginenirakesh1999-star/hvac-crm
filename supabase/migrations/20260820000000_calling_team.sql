-- Calling team: per-agent accounts, assigned Twilio numbers, and isolated,
-- persisted call logs. Built on Supabase Auth (auth.users). Each agent sees
-- only their own calls; admins see everyone's.

create type public.agent_role as enum ('admin', 'agent');

-- One profile per auth user. Holds role + the caller ID assigned to that agent.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.agent_role not null default 'agent',
  twilio_number text,          -- assigned caller ID, E.164
  twilio_number_sid text,      -- Twilio phone-number SID
  daily_call_target integer not null default 40,
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- Admin check that does not recurse into profiles' own RLS (security definer
-- runs as owner, bypassing RLS).
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Every completed call, attributed to the agent who made it.
create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  dealership_name text,
  dealership_phone text not null,
  direction text not null default 'outbound',
  twilio_call_sid text,
  status text,                 -- completed / no-answer / busy / failed / canceled
  duration_seconds integer not null default 0,
  outcome text,                -- e.g. "Sending denials", "Call back", "Not interested"
  notes text,
  recording_sid text,
  is_conversion boolean not null default false,
  created_at timestamptz not null default now()
);

create index call_logs_agent_idx on public.call_logs(agent_id, created_at desc);
create index call_logs_conversion_idx on public.call_logs(agent_id) where is_conversion;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.call_logs enable row level security;

-- profiles: an agent sees/edits their own row; admins see and manage all.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- call_logs: agents read/write only their own; admins read everyone's.
create policy call_logs_select on public.call_logs
  for select to authenticated
  using (agent_id = (select auth.uid()) or public.is_admin());

create policy call_logs_insert on public.call_logs
  for insert to authenticated
  with check (agent_id = (select auth.uid()));

create policy call_logs_update on public.call_logs
  for update to authenticated
  using (agent_id = (select auth.uid()) or public.is_admin())
  with check (agent_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Auto-create a profile whenever a new auth user is created.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
