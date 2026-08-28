-- Lead pipeline: admin distributes leads to callers; each lead is a tracked
-- record moving through stages (new -> attempted -> contacted -> callback ->
-- appointment -> won / lost / dnc). Calls and appointments link back to a lead
-- so the whole journey is traceable from caller to admin.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type public.lead_status as enum
      ('new', 'attempted', 'contacted', 'callback', 'appointment', 'won', 'lost', 'dnc');
  end if;
end $$;

-- keep updated_at fresh (the helper was dropped with the legacy schema)
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  assigned_to uuid references public.profiles(id) on delete set null, -- the caller
  name text,
  business text,
  phone text not null,
  status public.lead_status not null default 'new',
  attempts integer not null default 0,
  last_contacted_at timestamptz,
  callback_at timestamptz,
  notes text,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assignee_status_idx on public.leads(assigned_to, status);
create index if not exists leads_callback_idx on public.leads(assigned_to, callback_at) where status = 'callback';

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- link calls + appointments back to the lead
alter table public.call_logs add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.appointments add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.leads enable row level security;

-- callers see/work their own assigned leads; admins see/manage all
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (assigned_to = (select auth.uid()) or public.is_admin());

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated
  with check (public.is_admin());

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
  using (assigned_to = (select auth.uid()) or public.is_admin())
  with check (assigned_to = (select auth.uid()) or public.is_admin());

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated
  using (public.is_admin());
