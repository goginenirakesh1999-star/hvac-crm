import { NextRequest, NextResponse } from "next/server";
import { isValidTwilioRequest } from "@/lib/twilio";

// TwiML the browser's outbound call hits (via the TwiML App Voice URL).
// Dials the target dealership from the Rocky Solutions number.
//
// This route cannot sit behind the dialer passcode — Twilio can't present one — so it
// verifies X-Twilio-Signature instead. That check is active once WEBHOOK_BASE_URL is set,
// which it must be in production; without it anyone could POST here and place calls.
//
// Recording is opt-in per call, passed from the console as Record=1. Off by default:
// several states in the call list require all-party consent, and a cold call is exactly
// where that matters. When on, the callee hears a notice before being bridged in.
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
  const origin = new URL(req.url).origin;
  const callerId = process.env.TWILIO_CALLER_ID!;

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
