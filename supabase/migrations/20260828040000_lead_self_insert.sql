-- Let callers add their own leads (self-assigned). Admins can still insert for
-- anyone; a caller may only insert rows assigned to themselves.
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated
  with check (public.is_admin() or assigned_to = (select auth.uid()));
