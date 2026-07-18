import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendSms } from "@/lib/twilio";

// Blueprint Task 5: mark jobs paid, notify the owner, and queue the
// Google-review SMS for 24 hours later (drained by /api/cron/review-sms).
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  if (secret) {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new NextResponse("missing signature", { status: 400 });
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      return new NextResponse("invalid signature", { status: 400 });
    }
  } else {
    // Local development only — set STRIPE_WEBHOOK_SECRET in production.
    console.warn("stripe webhook: STRIPE_WEBHOOK_SECRET unset, skipping verification");
    event = JSON.parse(rawBody) as Stripe.Event;
  }

  if (event.type !== "checkout.session.completed" && event.type !== "invoice.paid") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const object = event.data.object as Stripe.Checkout.Session | Stripe.Invoice;
    const jobId = object.metadata?.job_id;
    const supabase = createAdminClient();

    let jobQuery = supabase
      .from("jobs")
      .select("id, tenant_id, description, quoted_price, status");
    const { data: job } = jobId
      ? await jobQuery.eq("id", jobId).maybeSingle()
      : await jobQuery.eq("stripe_invoice_id", (object as Stripe.Invoice).id ?? "").maybeSingle();

    if (!job) {
      console.error("stripe webhook: job not found", event.type, jobId);
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (job.status === "paid") return NextResponse.json({ ok: true, duplicate: true });

    const reviewDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("jobs")
      .update({ status: "paid", review_sms_due_at: reviewDueAt })
      .eq("id", job.id);
    if (error) throw error;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, owner_phone, twilio_phone_number")
      .eq("id", job.tenant_id)
      .maybeSingle();

    if (tenant?.twilio_phone_number) {
      const amount =
        "amount_total" in object && object.amount_total != null
          ? object.amount_total / 100
          : job.quoted_price;
      await sendSms(
        tenant.owner_phone,
        tenant.twilio_phone_number,
        `Payment received${amount ? `: $${amount}` : ""}${
          job.description ? ` for "${job.description}"` : ""
        }. Job #${job.id.slice(0, 8)} is paid.`
      );
    }
  } catch (err) {
    console.error("stripe webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
