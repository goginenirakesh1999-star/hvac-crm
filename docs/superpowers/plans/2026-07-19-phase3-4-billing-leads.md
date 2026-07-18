# HVAC CRM Phases 3–4: Billing, Reviews & Lead Gen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blueprint Tasks 5–7: Stripe payment webhook with owner notification + 24h-delayed Google-review SMS, speed-to-lead ingestion webhook, and throttled database-reactivation campaigns.

**Architecture:** Review scheduling uses two columns on `jobs` (`review_sms_due_at`, `review_sms_sent_at`) drained by a cron route (`/api/cron/review-sms`, hourly via `vercel.json`) — no new infra (pg_cron/QStash deferred; same behavior). Stripe webhook verifies signatures via `STRIPE_WEBHOOK_SECRET` (raw-body constructEvent). Lead ingestion and campaign routes are secret-guarded server endpoints. Campaign throttling = max 50 leads per invocation.

**Tech Stack:** Existing libs; new env: `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `LEADS_WEBHOOK_SECRET`.

## Global Constraints
- Review SMS text per blueprint: "Thanks for choosing [Tenant Name]! Please leave us a review: [google_business_link]" — sent ~24h after payment.
- Stripe events handled: `checkout.session.completed`, `invoice.paid`; job resolved via `metadata.job_id` (set in Phase 2), fallback `stripe_invoice_id`.
- Campaign throttle: ≤50 calls per run (blueprint: 50/hour; run route is invoked at most hourly).
- Webhooks return 2xx after auth passes; internal failures logged.

---
### Task 1: Migration — review scheduling columns
- [ ] `supabase/migrations/20260719000000_review_sms_schedule.sql`: `alter table public.jobs add column review_sms_due_at timestamptz, add column review_sms_sent_at timestamptz;` + update `database.types.ts`.
- [ ] Apply to live DB via pooler (`aws-1-us-east-2`, session mode) with `pg`; verify columns exist. Commit.

### Task 2: Stripe webhook (blueprint Task 5)
- [ ] `src/app/api/webhooks/stripe/route.ts`: constructEvent on raw text body; on paid events → job status `paid`, `review_sms_due_at = now()+24h`, SMS owner "Payment received: $X for [description]". Verify build + live smoke (seed tenant/job, unsigned-dev mode). Commit.

### Task 3: Review-SMS cron drain
- [ ] `src/app/api/cron/review-sms/route.ts` (GET, `Authorization: Bearer CRON_SECRET`): jobs where `status=paid and review_sms_due_at<=now() and review_sms_sent_at is null`, join tenant + settings `google_business_link`; send SMS, stamp sent. `vercel.json` hourly cron. Commit.

### Task 4: Leads webhook + campaign runner (blueprint Tasks 6–7)
- [ ] `src/app/api/webhooks/leads/incoming/route.ts` (`x-webhook-secret` = `LEADS_WEBHOOK_SECRET`): body `{tenant_id, name, phone, source}` → insert lead → immediate Retell outbound call (failure keeps the lead).
- [ ] `src/app/api/campaigns/run/route.ts` (POST, Bearer `CRON_SECRET`): `{tenant_id, status='new', limit≤50}` → for each lead createRetellCall + mark `contacted`.
- [ ] Verify: vitest + build + live smoke of leads insert. Update `.env.example`. Commit + push.

## Self-Review
- Tasks 5/6/7 covered ✔; 24h delay via due-at column + hourly cron (≤1h jitter — acceptable MVP, noted) ✔; throttle ✔.
