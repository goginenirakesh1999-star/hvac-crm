# 🏗️ AI-Powered HVAC Operations & Lead Gen SaaS Blueprint

## 🎯 Project Overview
This project is a multi-tenant SaaS application tailored for local HVAC companies in the United States. It functions as an invisible "Digital Dispatcher & Revenue Recovery Engine," allowing business owners to run their operations heavily via SMS from their personal phones, while an AI handles customer calls, lead generation, and invoicing.

**Goal:** Build an API-first, mobile-centric unified platform relying on powerful third-party tools and open-source integrations to minimize complex UI development.

---

## 🛠️ Tech Stack & Core Services

### **The Foundation**
*   **Framework:** Next.js (App Router, Server Actions, API routes).
*   **Boilerplate:** Start by forking a Supabase/Next.js SaaS boilerplate.
    *   *Recommended:* `boxyhq/saas-starter-kit` (Excellent for multi-tenant structure and security) OR `makerkit.dev/next-supabase` (if you have the license, excellent for rapid SaaS building).
*   **Database & Auth:** Supabase (PostgreSQL with Row Level Security for multi-tenancy).
*   **Payments & Invoicing:** Stripe (Stripe Connect for multi-tenant payouts, Stripe Invoicing API).

### **The AI & Communications Layer**
*   **Telephony & SMS:** Twilio (Subaccounts for each tenant, Webhooks for SMS/Call routing).
*   **Voice AI:** Retell AI (API for inbound call answering, outbound calling, and dynamic prompt injection).
*   **Omnichannel Inbox:** Chatwoot (Open-source, self-hosted, or cloud) integrated via API for a unified dashboard view.

### **The Lead Generation Suite (Open Source Integrations)**
*   **Ad Automations:** n8n (`n8n-io/n8n`) or Activepieces (`activepieces/activepieces`) to handle Facebook/Google Lead Ad webhooks.
*   **Website Chat Widget:** Typebot (`baptisteArno/typebot.io`) for custom, embeddable conversational lead capture.

---

## 🏗️ Phase 1: Core Multi-Tenant Architecture & Database

**Context for Claude:** We need a robust relational database schema that enforces tenant isolation. Every table must have a `tenant_id` linked to the central `organizations`/`tenants` table.

### 📝 Task 1: Supabase Schema Setup
Create the SQL migrations for the following core tables:
1.  **`tenants`**: `id`, `name`, `owner_phone`, `twilio_subaccount_sid`, `twilio_phone_number`, `stripe_connect_account_id`.
2.  **`jobs`**: `id`, `tenant_id`, `customer_name`, `customer_phone`, `description`, `status` (enum: pending, booked, completed, paid), `quoted_price`, `stripe_invoice_id`.
3.  **`leads`**: `id`, `tenant_id`, `name`, `phone`, `source` (facebook, typebot, manual), `status`.
4.  **`settings`**: `id`, `tenant_id`, `google_business_link`, `diagnostic_fee`, `ai_system_prompt`.

*Constraint: Ensure Row Level Security (RLS) is strictly enforced on all tables based on `tenant_id`.*

---

## 📞 Phase 2: The Autonomous Voice & SMS Engine

**Context for Claude:** This is the core of the app. The owner should be able to run the business via text message, and the AI should handle missed calls.

### 📝 Task 2: Twilio Missed Call Webhook (Inbound)
Create a Next.js API route (`/api/webhooks/twilio/voice-status`).
*   **Logic:** Listen for Twilio `StatusCallback`. If `CallStatus` is `no-answer` or `busy`, extract the caller's phone number and the dialed number (to identify the `tenant_id`).
*   **Action:** Make a POST request to Retell AI's `/create-phone-call` endpoint to trigger an immediate outbound callback using the tenant's specific system prompt and diagnostic fee.

### 📝 Task 3: Retell AI Post-Call Webhook (Data Extraction)
Create a Next.js API route (`/api/webhooks/retell/call-completed`).
*   **Logic:** Parse the JSON payload from Retell AI. Extract custom variables (e.g., `customer_issue`, `quoted_price`, `appointment_time`).
*   **Action 1:** Insert a new row into the `jobs` table in Supabase.
*   **Action 2:** Use the Twilio SDK to send an SMS to the customer confirming the details.
*   **Action 3:** Use the Twilio SDK to send an SMS to the tenant's `owner_phone` alerting them of the new job.

### 📝 Task 4: The Owner's SMS Command Center
Create a Next.js API route (`/api/webhooks/twilio/incoming-sms`).
*   **Logic:** Check if the incoming sender number matches any `owner_phone` in the `tenants` table.
*   **Action:** If it does, parse the text body.
    *   If it matches the regex pattern: `QUOTE [Phone Number] $[Amount] [Description]`, generate a Stripe Payment Link and use Twilio to text that link to the target customer.
    *   If it matches `INVOICE [Phone Number] $[Amount] [Description]`, create a Stripe Invoice and text it to the customer.

---

## 💰 Phase 3: Billing & Reputation Management

**Context for Claude:** We need to automate the flow of money and Google Reviews without the owner needing to click buttons in a dashboard.

### 📝 Task 5: Stripe Webhook & Review Automation Trigger
Create a Next.js API route (`/api/webhooks/stripe`).
*   **Logic:** Listen for the `checkout.session.completed` or `invoice.paid` event.
*   **Action 1:** Find the corresponding `job_id` and update its status to `paid` in Supabase.
*   **Action 2:** Send an SMS to the `owner_phone` confirming receipt of funds.
*   **Action 3 (Review Engine):** Schedule a task (using Supabase `pg_cron` or a tool like Upstash QStash) to fire exactly 24 hours later. This scheduled task must use Twilio to text the customer: *"Thanks for choosing [Tenant Name]! Please leave us a review: [Tenant Google Business Link]"*.

---

## 🚀 Phase 4: Lead Generation Integrations

**Context for Claude:** We are wrapping open-source tools into our SaaS to provide high-ROI lead generation.

### 📝 Task 6: Speed-to-Lead Webhook (Activepieces/n8n Integration)
Create a Next.js API route (`/api/webhooks/leads/incoming`).
*   **Logic:** This endpoint will receive payloads from our hidden Activepieces/n8n instance (which handles the Facebook/Google Ads OAuth and webhooks).
*   **Action:** When a payload (Name, Phone) is received, insert it into the `leads` table and immediately trigger Retell AI to make an outbound call to the lead.

### 📝 Task 7: Database Reactivation Engine
Create a Next.js server action/API route (`/api/campaigns/run`).
*   **Logic:** Allow a tenant to trigger a campaign for all contacts in their `leads` table with a specific status.
*   **Action:** Implement rate-limiting/throttling (e.g., 50 calls per hour) to loop through the leads and send POST requests to Retell AI for an outbound "Spring Tune-Up" campaign.

---

## 🚫 What NOT to Include / Out of Scope
*   **DO NOT build a custom visual Website Builder:** We will provide the user with a Typebot (`baptisteArno/typebot.io`) script tag to embed on their existing site.
*   **DO NOT build a complex unified inbox from scratch:** We will use Chatwoot (`chatwoot/chatwoot`) embedded via iframe or API for the omnichannel inbox.
*   **DO NOT overcomplicate the Frontend UI:** The MVP's value is the *invisible* SMS automation. Keep the Next.js dashboard extremely simple: Settings, Job List, Lead Upload CSV, and Stripe Connect onboarding.
*   **DO NOT build a custom calendar UI:** Integrate Cal.com API for appointment slot management during the AI call.

---

## 🏁 Instructions for Claude
1. Please review this blueprint.
2. Initialize the project using the suggested tech stack.
3. Begin executing **Phase 1, Task 1** (Supabase Schema). Do not move to Phase 2 until the database schema and RLS policies are fully generated and confirmed.