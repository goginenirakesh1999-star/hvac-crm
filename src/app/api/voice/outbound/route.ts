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
// Recording is opt-in per call (Record=1 from the console). When on, the callee
// hears a notice before being bridged in.
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
  const record = String(form.get("Record") ?? "") === "1";
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

  const recordAttrs = record
    ? ` record="record-from-answer-dual"` +
      ` recordingStatusCallback="${origin}/api/voice/recording"` +
      ` recordingStatusCallbackEvent="completed"`
    : "";
  const whisper = record ? ` url="${origin}/api/voice/whisper"` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" answerOnBridge="true"${recordAttrs}>
    <Number${whisper}>${to}</Number>
  </Dial>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
