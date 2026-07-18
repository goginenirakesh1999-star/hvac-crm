# HVAC CRM Phase 1: Core Multi-Tenant Architecture & Database — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Next.js + Supabase project and create the Phase 1 database schema (tenants, jobs, leads, settings) with strict tenant-scoped RLS.

**Architecture:** Greenfield Next.js App Router app with `@supabase/ssr` clients. Schema lives in `supabase/migrations/` SQL files. Multi-tenancy is enforced with Postgres RLS: every tenant-scoped table carries `tenant_id`, and policies check membership via a `tenant_members` table keyed on `auth.uid()`. Webhook/server code will use the service-role key (bypasses RLS) in later phases.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), Supabase (Postgres + Auth), Supabase CLI for migrations.

## Global Constraints

- Every tenant-scoped table MUST have `tenant_id uuid not null references public.tenants(id)` and RLS enabled (blueprint constraint: "RLS is strictly enforced on all tables based on tenant_id").
- Table names exactly as blueprint: `tenants`, `jobs`, `leads`, `settings` (plus `tenant_members` for auth↔tenant mapping — minimal necessary addition).
- `jobs.status` enum values exactly: `pending, booked, completed, paid`. `leads.source` values: `facebook, typebot, manual`.
- Keep dashboard/frontend minimal — Phase 1 delivers NO UI beyond the scaffold.
- Do NOT proceed to Phase 2 (blueprint: schema must be confirmed by owner first).
- No Docker available: verification = SQL parse check + `npm run build`; live `supabase db push` deferred to user.

---

### Task 1: Project scaffold + git init

**Files:**
- Create: Next.js scaffold at repo root (`package.json`, `src/app/*`, configs) via create-next-app
- Create: `.gitignore` (from scaffold), keep existing `claude.md`

**Interfaces:**
- Produces: working Next.js TypeScript app; `npm run build` passes.

- [ ] **Step 1: git init, then scaffold into a temp dir and merge to root** (create-next-app refuses non-empty dirs)

```powershell
git init
npx --yes create-next-app@latest webtmp --ts --app --tailwind --eslint --src-dir --use-npm --no-import-alias --yes
# move contents of webtmp into repo root, then remove webtmp
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — Expected: compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app (TypeScript, App Router, Tailwind)"
```

### Task 2: Supabase migration — core schema + RLS

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`)
- Create: `supabase/migrations/20260718000000_core_schema.sql`

**Interfaces:**
- Produces: tables `public.tenants`, `public.tenant_members`, `public.jobs`, `public.leads`, `public.settings`; enums `job_status`, `lead_source`, `lead_status`; helper `public.is_tenant_member(uuid)`.

- [ ] **Step 1: `npx supabase init`**
- [ ] **Step 2: Write migration SQL** (full SQL in repo file; includes: enums, tenants with owner_user_id, tenant_members(user_id, tenant_id, role), jobs, leads, settings with unique tenant_id, `is_tenant_member()` security-definer helper, `enable row level security` + select/insert/update/delete policies on every table, indexes on all tenant_id columns)
- [ ] **Step 3: Verify — parse every migration statement**

Run a Node script using `libpg-query` (real Postgres parser) against the migration file. Expected: 0 syntax errors, and assert every created table has a matching `ENABLE ROW LEVEL SECURITY` + at least one policy.

- [ ] **Step 4: Commit**

```bash
git add supabase && git commit -m "feat: Phase 1 core schema with tenant-scoped RLS"
```

### Task 3: Supabase client wiring + env template

**Files:**
- Create: `.env.example` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts`
- Create: `src/lib/database.types.ts` (hand-written Phase 1 types matching migration)

**Interfaces:**
- Produces: `createClient()` (browser), `createServerSupabase()` (server, cookie-aware), `createAdminClient()` (service-role, server-only) — consumed by all Phase 2+ webhook routes.

- [ ] **Step 1: `npm i @supabase/supabase-js @supabase/ssr`**
- [ ] **Step 2: Write clients + types**
- [ ] **Step 3: Verify — `npm run build` passes with new files type-checked**
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: supabase client wiring and Phase 1 db types"`

## Self-Review
- Spec coverage: blueprint Task 1 tables ✔ (all 4 + membership), RLS ✔, boilerplate foundation ✔ (clean scaffold chosen over boxyhq fork — boxyhq is Prisma-based, not Supabase; deviation surfaced to user).
- Verification limited by no Docker — surfaced in Global Constraints; user runs `supabase link && supabase db push` to apply.
