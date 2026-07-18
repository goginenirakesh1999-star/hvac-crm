import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRetellCall } from "@/lib/retell";
import { isValidTwilioRequest } from "@/lib/twilio";

// Blueprint Task 2: when a tenant misses a call (no-answer/busy), have the
// Retell AI agent immediately call the customer back.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = Object.fromEntries(
    [...form.entries()].map(([k, v]) => [k, String(v)])
  );

  if (
    !isValidTwilioRequest(
      req.headers.get("x-twilio-signature"),
      "/api/webhooks/twilio/voice-status",
      params
    )
  ) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const callStatus = params.CallStatus;
  const caller = params.From;
  const dialedNumber = params.To ?? params.Called;

  if (!["no-answer", "busy"].includes(callStatus) || !caller || !dialedNumber) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const supabase = createAdminClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, twilio_phone_number")
      .eq("twilio_phone_number", dialedNumber)
      .maybeSingle();

    if (!tenant?.twilio_phone_number) {
      console.error(`voice-status: no tenant for number ${dialedNumber}`);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { data: settings } = await supabase
      .from("settings")
      .select("diagnostic_fee, ai_system_prompt")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    await createRetellCall({
      fromNumber: tenant.twilio_phone_number,
      toNumber: caller,
      tenantId: tenant.id,
      dynamicVariables: {
        business_name: tenant.name,
        diagnostic_fee: settings?.diagnostic_fee != null ? String(settings.diagnostic_fee) : "",
        ai_system_prompt: settings?.ai_system_prompt ?? "",
      },
    });
  } catch (err) {
    // Always 2xx so Twilio doesn't retry-storm; the failure is in our logs.
    console.error("voice-status webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
