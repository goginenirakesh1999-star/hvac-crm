import { NextRequest, NextResponse } from "next/server";
import { isValidTwilioRequest } from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type CallLogUpdate = Database["public"]["Tables"]["call_logs"]["Update"];

// Fires on the PARENT call when <Dial> finishes, for every outbound call the
// console places — answered, busy, rang out, failed or cancelled alike.
//
// This is the authoritative log. The browser also logs on hang-up, but that
// depends on the tab still being open; this does not, so a rep closing the
// laptop mid-call still leaves a complete record. Both write the same row,
// matched on the parent CallSid.
//
// An outcome is derived from what Twilio reports so nothing is ever blank, but
// a disposition the rep chose themselves is never overwritten.
function autoOutcome(dialStatus: string, seconds: number): string {
  switch (dialStatus) {
    case "busy": return "Line busy";
    case "no-answer": return "Rang, no answer";
    case "failed": return "Call failed";
    case "canceled": return "Cancelled before answer";
    case "completed": return seconds < 15 ? "Connected, ended quickly" : "Connected, no disposition";
    default: return `Ended (${dialStatus || "unknown"})`;
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent") ?? "";
  const leadId = url.searchParams.get("lead") ?? "";
  // Twilio signs the full URL including the query string.
  const signedPath = "/api/voice/dial-status" + url.search;
  if (!isValidTwilioRequest(req.headers.get("x-twilio-signature"), signedPath, params)) {
    return new NextResponse("Invalid signature.", { status: 403 });
  }

  const callSid = String(form.get("CallSid") ?? "");
  const dialStatus = String(form.get("DialCallStatus") ?? "");
  const seconds = parseInt(String(form.get("DialCallDuration") ?? "0"), 10) || 0;
  const to = String(form.get("To") ?? "");

  if (callSid && agentId) {
    const db = createAdminClient();
    const { data: existing } = await db
      .from("call_logs")
      .select("id, outcome")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (existing) {
      const patch: CallLogUpdate = {
        status: dialStatus || null,
        duration_seconds: seconds,
      };
      // Only fill an outcome in; never clobber the rep's own disposition.
      if (!existing.outcome) patch.outcome = autoOutcome(dialStatus, seconds);
      await db.from("call_logs").update(patch).eq("id", existing.id);
    } else {
      await db.from("call_logs").insert({
        agent_id: agentId,
        dealership_phone: to || "unknown",
        twilio_call_sid: callSid,
        status: dialStatus || null,
        duration_seconds: seconds,
        outcome: autoOutcome(dialStatus, seconds),
        lead_id: leadId || null,
      });
    }
  }

  // <Dial> is the last verb, so an empty response simply ends the call.
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    headers: { "Content-Type": "text/xml" },
  });
}
