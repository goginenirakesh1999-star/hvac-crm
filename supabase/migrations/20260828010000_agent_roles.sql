-- Split the non-admin staff into two job types: callers (cold outreach) and
-- closers (follow-up / closing). Roles are assigned per account at creation.
-- Existing 'admin' and legacy 'agent' values are untouched; the dashboard
-- treats a legacy 'agent' as a caller.

alter type public.agent_role add value if not exists 'caller';
alter type public.agent_role add value if not exists 'closer';
