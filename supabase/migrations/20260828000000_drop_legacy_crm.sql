-- Teardown: the app is now a calling system only. Drop the legacy HVAC CRM
-- schema (Phase 1 core_schema + Phase 3 review-SMS additions). The calling
-- team schema (profiles, call_logs, is_admin, handle_new_user) is untouched.
--
-- Safe/idempotent: every drop guards with `if exists`. `cascade` removes the
-- tables' own policies, indexes, triggers, and cross-references.

drop table if exists public.settings cascade;
drop table if exists public.leads cascade;
drop table if exists public.jobs cascade;
drop table if exists public.tenant_members cascade;
drop table if exists public.tenants cascade;

drop function if exists public.is_tenant_member(uuid) cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.job_status;
drop type if exists public.lead_source;
drop type if exists public.lead_status;
drop type if exists public.tenant_role;
