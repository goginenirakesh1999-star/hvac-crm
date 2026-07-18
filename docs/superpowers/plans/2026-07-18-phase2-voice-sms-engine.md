# HVAC CRM Phase 2: Autonomous Voice & SMS Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blueprint Tasks 2-4: Twilio missed-call → Retell callback webhook, Retell post-call data-extraction webhook, and the owner's SMS command center (QUOTE/INVOICE → Stripe).

**Architecture:** Three Next.js route handlers under `src/app/api/webhooks/`. All DB access uses the service-role admin client (webhooks have no user session; RLS bypass is intentional). Thin integration libs in `src/lib/` (twilio, retell, stripe) plus a pure, unit-tested command parser. Twilio webhook authenticity checked via X-Twilio-Signature when `WEBHOOK_BASE_URL` is set.

**Tech Stack:** twilio SDK, stripe SDK, Retell REST API (fetch), vitest for the parser.

## Global Constraints

- Owner command syntax exactly per blueprint: `QUOTE [Phone] $[Amount] [Description]`, `INVOICE [Phone] $[Amount] [Description]`.
- Missed-call trigger statuses: `no-answer`, `busy`.
- New env vars (server-only): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `RETELL_API_KEY`, `RETELL_AGENT_ID`, `STRIPE_SECRET_KEY`, `WEBHOOK_BASE_URL`.
- Webhooks must always return 2xx quickly (Twilio retries otherwise); errors logged, not thrown.

---

### Task 1: Integration libs + command parser (TDD)
**Files:** Create `src/lib/twilio.ts`, `src/lib/retell.ts`, `src/lib/stripe.ts`, `src/lib/owner-commands.ts`, test `src/lib/owner-commands.test.ts`.
- [ ] `npm i twilio stripe; npm i -D vitest`
- [ ] Failing tests for parser: QUOTE/INVOICE happy paths, case-insensitivity, 10-digit → +1 E.164 normalization, decimals, rejects garbage. Run `npx vitest run` → FAIL.
- [ ] Implement `parseOwnerCommand(body): {kind:'quote'|'invoice', phone, amount, description} | null`; tests PASS.
- [ ] Commit.

### Task 2: Twilio voice-status webhook (blueprint Task 2)
**Files:** Create `src/app/api/webhooks/twilio/voice-status/route.ts`.
- [ ] POST handler: parse form body; if `CallStatus` ∈ {no-answer, busy}, look up tenant by `To` number (admin client), load settings, POST Retell `/v2/create-phone-call` with `from_number` = tenant Twilio number, `to_number` = caller, `metadata.tenant_id`, dynamic variables (business_name, diagnostic_fee, ai_system_prompt). Return 200 always.
- [ ] Verify: `npm run build`; commit.

### Task 3: Retell call-completed webhook (blueprint Task 3)
**Files:** Create `src/app/api/webhooks/retell/call-completed/route.ts`.
- [ ] POST handler: on `call_analyzed` event, resolve tenant from `call.metadata.tenant_id` (fallback: from_number lookup), extract `custom_analysis_data` (customer_issue, quoted_price, appointment_time, customer_name), insert `jobs` row (status booked if appointment_time else pending), SMS customer confirmation + owner alert via Twilio.
- [ ] Verify: `npm run build`; commit.

### Task 4: Owner SMS command center (blueprint Task 4)
**Files:** Create `src/app/api/webhooks/twilio/incoming-sms/route.ts`.
- [ ] POST handler: match `From` against `tenants.owner_phone`; parse command. QUOTE → Stripe Checkout Session (ad-hoc price_data, metadata.job_id) → SMS link to customer. INVOICE → Stripe customer + invoice (send_invoice, finalize) → SMS `hosted_invoice_url`. Both insert a `jobs` row (status pending, quoted_price, stripe_invoice_id when applicable). Reply TwiML confirmation to owner; unknown text → help reply.
- [ ] Verify: `npx vitest run` + `npm run build`; update `.env.example`; commit + push.

## Self-Review
- Blueprint Tasks 2/3/4 each map to a task ✔; exact command regex tested ✔; service-role usage confined to route handlers/server libs ✔.
- Live verification of Twilio/Retell/Stripe requires those account credentials — deferred to user; code verified by unit tests + typed build.
