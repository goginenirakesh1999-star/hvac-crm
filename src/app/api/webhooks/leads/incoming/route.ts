import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRetellCall } from "@/lib/retell";
import { normalizePhone } from "@/lib/owner-commands";
import type { LeadSource } from "@/lib/database.types";

interface IncomingLead {
  tenant_id?: string;
  name?: string;
  phone?: string;
  source?: string;
}

const SOURCES: LeadSource[] = ["facebook", "typebot", "manual"];

// Blueprint Task 6: speed-to-lead. Activepieces/n8n posts new ad leads here;
// we store the lead and have the AI call it immediately.
export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.LEADS_WEBHOOK_SECRET) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let body: IncomingLead;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (!body.tenant_id || !phone) {
    return NextResponse.json({ ok: false, error: "tenant_id and valid phone required" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, twilio_phone_number")
    .eq("id", body.tenant_id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "unknown tenant" }, { status: 422 });
  }

  const source = SOURCES.includes(body.source as LeadSource)
    ? (body.source as LeadSource)
    : "manual";

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: tenant.id,
      name: body.name ?? null,
      phone,
      source,
      status: "new",
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Speed-to-lead: call immediately. A failed call keeps the stored lead.
  if (tenant.twilio_phone_number) {
    try {
      await createRetellCall({
        fromNumber: tenant.twilio_phone_number,
        toNumber: phone,
        tenantId: tenant.id,
        dynamicVariables: {
          business_name: tenant.name,
          lead_name: body.name ?? "",
          call_reason: "new_lead_followup",
        },
      });
      await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id);
    } catch (err) {
      console.error("leads/incoming: retell call failed:", err);
    }
  }

  return NextResponse.json({ ok: true, lead_id: lead.id });
}
