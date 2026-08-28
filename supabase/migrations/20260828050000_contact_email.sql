-- Capture the client's email so Cal.com can send them the confirmation and we
-- keep it on the lead/appointment for follow-up.
alter table public.appointments add column if not exists prospect_email text;
alter table public.leads add column if not exists email text;
