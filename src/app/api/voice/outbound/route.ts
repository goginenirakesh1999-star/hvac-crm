import { NextRequest, NextResponse } from "next/server";
import { isValidTwilioRequest } from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

// TwiML the browser's outbound call hits (via the TwiML App Voice URL).
// Dials the target dealership from the calling agent's OWN assigned number.
//
// This route cannot sit behind the login — Twilio can't present a session — so it
// verifies X-Twilio-Signature instead. That check is active once WEBHOOK_BASE_URL is set,
// which it must be in production; without it anyone could POST here and place calls.
//
// The caller ID is resolved from the agent placing the call: Twilio sends
// From="client:<agent-id>", and we look up that agent's twilio_number. Falls back
// to the shared TWILIO_CALLER_ID if the agent has no number assigned yet.
//
// Every call is recorded. This is enforced server-side.
// TwiML is XML: any value interpolated into an attribute must be escaped, or a
// bare "&" in a query string is read as an entity and Twilio rejects the whole
// document with "an application error has occurred".
function xmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  if (!isValidTwilioRequest(req.headers.get("x-twilio-signature"), "/api/voice/outbound", params)) {
    return new NextResponse("Invalid signature.", { status: 403 });
  }

  const to = String(form.get("To") ?? "").replace(/[^\d+]/g, "");
  const leadId = String(form.get("LeadId") ?? "");
  const from = String(form.get("From") ?? "");
  const origin = new URL(req.url).origin;

  // Resolve the agent's assigned caller ID from their identity.
  let callerId = process.env.TWILIO_CALLER_ID!;
  const agentId = from.startsWith("client:") ? from.slice("client:".length) : "";
  if (agentId) {
    try {
      const { data } = await createAdminClient()
        .from("profiles")
        .select("twilio_number")
        .eq("id", agentId)
        .maybeSingle();
      if (data?.twilio_number) callerId = data.twilio_number;
    } catch {
      // fall back to the shared number
    }
  }

  // Recording is mandatory and decided here, not by the client — a caller
  // cannot opt out by omitting a parameter.
  const recordAttrs =
    ` record="record-from-answer-dual"` +
    ` recordingStatusCallback="${xmlAttr(origin + "/api/voice/recording")}"` +
    ` recordingStatusCallbackEvent="completed"`;

  // Every call reports its own ending here, so the CRM is complete even if the
  // rep's browser never gets the chance to log it.
  const statusUrl = xmlAttr(
    `${origin}/api/voice/dial-status?agent=${encodeURIComponent(agentId)}` +
      (leadId ? `&lead=${encodeURIComponent(leadId)}` : "")
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${xmlAttr(callerId)}" answerOnBridge="true" action="${statusUrl}" method="POST"${recordAttrs}>
    <Number>${xmlAttr(to)}</Number>
  </Dial>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
