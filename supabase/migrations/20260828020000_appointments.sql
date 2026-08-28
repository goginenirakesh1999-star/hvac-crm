-- Appointment-setting pipeline: callers book appointments with interested
-- prospects; the closer works them from an agenda and calls to close.
-- Callers create and see their own; the closer and admins see/update all.

-- role check for closers (::text avoids referencing a freshly-added enum value
-- as a literal in the same transaction the value may be added in).
create or replace function public.is_closer()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text = 'closer'
  );
$$;
revoke all on function public.is_closer() from public;
grant execute on function public.is_closer() to authenticated;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade, -- the caller
  prospect_name text,
  prospect_business text,
  prospect_phone text not null,
  scheduled_at timestamptz not null,
  notes text,                         -- caller's handoff notes for the closer
  status text not null default 'scheduled', -- scheduled | won | lost | no_show
  outcome_notes text,                 -- closer's notes after the close attempt
  closed_by uuid references public.profiles(id) on delete set null,
  twilio_call_sid text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_time_idx on public.appointments(scheduled_at);
create index if not exists appointments_creator_idx on public.appointments(created_by, scheduled_at);

alter table public.appointments enable row level security;

-- Callers see their own bookings; closer and admins see everything.
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_admin() or public.is_closer());

-- Any signed-in staff can book (attributed to themselves).
drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- Closer and admins update outcomes.
drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated
  using (public.is_admin() or public.is_closer())
  with check (public.is_admin() or public.is_closer());
