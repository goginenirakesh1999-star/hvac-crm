import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRetellCall } from "@/lib/retell";
import type { LeadStatus } from "@/lib/database.types";

const MAX_CALLS_PER_RUN = 50; // blueprint throttle: 50 calls/hour

// Blueprint Task 7: database reactivation. Calls up to 50 leads with the
// given status per invocation (invoke at most hourly for 50/hr throttling).
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let body: { tenant_id?: string; status?: LeadStatus; campaign?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  if (!body.tenant_id) {
    return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, twilio_phone_number")
    .eq("id", body.tenant_id)
    .maybeSingle();
  if (!tenant?.twilio_phone_number) {
    return NextResponse.json(
      { ok: false, error: "tenant missing or has no Twilio number" },
      { status: 422 }
    );
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, phone")
    .eq("tenant_id", tenant.id)
    .eq("status", body.status ?? "new")
    .limit(MAX_CALLS_PER_RUN);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let called = 0;
  for (const lead of leads ?? []) {
    try {
      await createRetellCall({
        fromNumber: tenant.twilio_phone_number,
        toNumber: lead.phone,
        tenantId: tenant.id,
        dynamicVariables: {
          business_name: tenant.name,
          lead_name: lead.name ?? "",
          call_reason: body.campaign ?? "spring_tune_up",
        },
      });
      await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id);
      called++;
    } catch (err) {
      console.error(`campaigns/run: lead ${lead.id} call failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, eligible: leads?.length ?? 0, called });
}
