import { NextRequest, NextResponse } from "next/server";
import { isValidTwilioRequest } from "@/lib/twilio";

// Inbound TwiML for the campaign caller-ID numbers. A dealer calling one of
// them back is forwarded to the business line.
//
// Like the outbound route this cannot sit behind the login — Twilio can't
// present a session — so it verifies X-Twilio-Signature instead.
//
// The caller ID shown on the business line is the campaign number that was
// dialed, not the dealer's own number: it is Twilio-owned so it always passes
// carrier attestation, and it tells the answerer which regional line rang.
// The dealer's number is on the call record either way.
export async function POST(req: NextRequest) {
  const form = await req.formData();

  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  if (!isValidTwilioRequest(req.headers.get("x-twilio-signature"), "/api/voice/inbound", params)) {
    return new NextResponse("Invalid signature.", { status: 403 });
  }

  const forwardTo = process.env.TWILIO_PHONE_NUMBER!;
  const dialed = String(form.get("To") ?? "").replace(/[^\d+]/g, "") || forwardTo;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${dialed}" timeout="25" answerOnBridge="true">
    <Number>${forwardTo}</Number>
  </Dial>
  <Say voice="Polly.Joanna">Sorry, no one is available to take your call right now. Please try again later.</Say>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
