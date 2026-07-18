-- Phase 1: Core multi-tenant schema for HVAC Operations SaaS
-- Tables: tenants, tenant_members, jobs, leads, settings
-- Multi-tenancy: every tenant-scoped table carries tenant_id; RLS policies
-- allow access only to members of that tenant (via tenant_members).
-- Server-side webhooks (Twilio/Retell/Stripe) use the service-role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.job_status as enum ('pending', 'booked', 'completed', 'paid');
create type public.lead_source as enum ('facebook', 'typebot', 'manual');
create type public.lead_status as enum ('new', 'contacted', 'converted', 'dead');
create type public.tenant_role as enum ('owner', 'member');

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_phone text not null,
  twilio_subaccount_sid text,
  twilio_phone_number text unique,
  stripe_connect_account_id text unique,
  created_at timestamptz not null default now()
);

-- Maps auth users to the tenants they belong to; the basis of all RLS checks.
create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_id_idx on public.tenant_members(user_id);

-- Security-definer helper so policies can check membership without recursing
-- into tenant_members' own RLS.
create function public.is_tenant_member(t_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = t_id and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text,
  customer_phone text not null,
  description text,
  status public.job_status not null default 'pending',
  quoted_price numeric(10, 2),
  stripe_invoice_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_tenant_id_idx on public.jobs(tenant_id);
create index jobs_tenant_status_idx on public.jobs(tenant_id, status);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text,
  phone text not null,
  source public.lead_source not null default 'manual',
  status public.lead_status not null default 'new',
  created_at timestamptz not null default now()
);

create index leads_tenant_id_idx on public.leads(tenant_id);
create index leads_tenant_status_idx on public.leads(tenant_id, status);

-- ---------------------------------------------------------------------------
-- settings (one row per tenant)
-- ---------------------------------------------------------------------------
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  google_business_link text,
  diagnostic_fee numeric(10, 2),
  ai_system_prompt text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.jobs enable row level security;
alter table public.leads enable row level security;
alter table public.settings enable row level security;

-- tenants: members can read/update their tenant; creation/deletion is done
-- server-side (service role) during onboarding.
create policy "tenants_select" on public.tenants
  for select to authenticated
  using (public.is_tenant_member(id));

create policy "tenants_update" on public.tenants
  for update to authenticated
  using (public.is_tenant_member(id))
  with check (public.is_tenant_member(id));

-- tenant_members: users can see membership rows of tenants they belong to.
-- Membership writes happen server-side (service role) during onboarding.
create policy "tenant_members_select" on public.tenant_members
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- jobs: full CRUD within your own tenant.
create policy "jobs_select" on public.jobs
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "jobs_insert" on public.jobs
  for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

create policy "jobs_update" on public.jobs
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "jobs_delete" on public.jobs
  for delete to authenticated
  using (public.is_tenant_member(tenant_id));

-- leads: full CRUD within your own tenant.
create policy "leads_select" on public.leads
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "leads_insert" on public.leads
  for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

create policy "leads_update" on public.leads
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "leads_delete" on public.leads
  for delete to authenticated
  using (public.is_tenant_member(tenant_id));

-- settings: read/insert/update within your own tenant (no delete; settings
-- rows live and die with the tenant via cascade).
create policy "settings_select" on public.settings
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "settings_insert" on public.settings
  for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

create policy "settings_update" on public.settings
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- keep jobs.updated_at fresh
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
