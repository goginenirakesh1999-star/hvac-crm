import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio";

// Blueprint Task 5, Action 3: drain due review requests (~24h after payment).
// Invoked hourly by Vercel Cron (see vercel.json).
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: dueJobs, error } = await supabase
    .from("jobs")
    .select("id, tenant_id, customer_phone")
    .eq("status", "paid")
    .is("review_sms_sent_at", null)
    .lte("review_sms_due_at", new Date().toISOString())
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  for (const job of dueJobs ?? []) {
    try {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, twilio_phone_number")
        .eq("id", job.tenant_id)
        .maybeSingle();
      const { data: settings } = await supabase
        .from("settings")
        .select("google_business_link")
        .eq("tenant_id", job.tenant_id)
        .maybeSingle();

      if (!tenant?.twilio_phone_number || !settings?.google_business_link) {
        // Can't send without a number and a review link; don't retry forever.
        await supabase
          .from("jobs")
          .update({ review_sms_sent_at: new Date().toISOString() })
          .eq("id", job.id);
        continue;
      }

      await sendSms(
        job.customer_phone,
        tenant.twilio_phone_number,
        `Thanks for choosing ${tenant.name}! Please leave us a review: ${settings.google_business_link}`
      );
      await supabase
        .from("jobs")
        .update({ review_sms_sent_at: new Date().toISOString() })
        .eq("id", job.id);
      sent++;
    } catch (err) {
      console.error(`review-sms: job ${job.id} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, due: dueJobs?.length ?? 0, sent });
}
