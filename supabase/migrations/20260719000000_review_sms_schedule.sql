-- Phase 3: schedule the post-payment Google-review SMS without extra infra.
-- A job becomes eligible when paid; the hourly cron route drains due rows.
alter table public.jobs
  add column review_sms_due_at timestamptz,
  add column review_sms_sent_at timestamptz;

create index jobs_review_due_idx on public.jobs (review_sms_due_at)
  where review_sms_sent_at is null and review_sms_due_at is not null;
