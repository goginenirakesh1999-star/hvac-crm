import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio";

interface RetellWebhookPayload {
  event: string;
  call?: {
    from_number?: string;
    to_number?: string;
    metadata?: { tenant_id?: string };
    call_analysis?: {
      custom_analysis_data?: {
        customer_name?: string;
        customer_issue?: string;
        quoted_price?: number | string;
        appointment_time?: string;
      };
    };
  };
}

// Blueprint Task 3: after the AI call ends, persist the job and notify
// both the customer and the owner by SMS.
export async function POST(req: NextRequest) {
  let payload: RetellWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  if (payload.event !== "call_analyzed" || !payload.call) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const call = payload.call;
  const custom = call.call_analysis?.custom_analysis_data ?? {};

  try {
    const supabase = createAdminClient();

    let tenantQuery = supabase
      .from("tenants")
      .select("id, name, owner_phone, twilio_phone_number");
    const tenantId = call.metadata?.tenant_id;
    const { data: tenant } = tenantId
      ? await tenantQuery.eq("id", tenantId).maybeSingle()
      : await tenantQuery.eq("twilio_phone_number", call.from_number ?? "").maybeSingle();

    if (!tenant) {
      console.error("call-completed: tenant not found", call.metadata, call.from_number);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const customerPhone = call.to_number;
    if (!customerPhone) return NextResponse.json({ ok: true, skipped: true });

    const quotedPrice =
      custom.quoted_price != null && custom.quoted_price !== ""
        ? Number(custom.quoted_price)
        : null;

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        tenant_id: tenant.id,
        customer_name: custom.customer_name ?? null,
        customer_phone: customerPhone,
        description: custom.customer_issue ?? null,
        quoted_price: Number.isFinite(quotedPrice) ? quotedPrice : null,
        status: custom.appointment_time ? "booked" : "pending",
      })
      .select("id")
      .single();
    if (error) throw error;

    const from = tenant.twilio_phone_number;
    if (from) {
      const apptLine = custom.appointment_time
        ? ` Your appointment: ${custom.appointment_time}.`
        : "";
      await sendSms(
        customerPhone,
        from,
        `Thanks for calling ${tenant.name}! We've logged your request${
          custom.customer_issue ? ` (${custom.customer_issue})` : ""
        }.${apptLine} We'll be in touch shortly.`
      );
      await sendSms(
        tenant.owner_phone,
        from,
        `New job #${job.id.slice(0, 8)}: ${custom.customer_name ?? "Unknown"} ${customerPhone}` +
          `${custom.customer_issue ? ` — ${custom.customer_issue}` : ""}` +
          `${custom.appointment_time ? ` @ ${custom.appointment_time}` : ""}` +
          `${quotedPrice ? ` ($${quotedPrice})` : ""}`
      );
    }
  } catch (err) {
    console.error("call-completed webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
