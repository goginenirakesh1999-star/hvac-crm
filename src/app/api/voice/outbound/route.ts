import { NextRequest, NextResponse } from "next/server";

// TwiML the browser's outbound call hits (via the TwiML App Voice URL).
// Dials the target business from the Rocky Solutions number, records the
// call (dual channel), and plays a recording notice to the callee first.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const to = String(form.get("To") ?? "").replace(/[^\d+]/g, "");
  const origin = new URL(req.url).origin;
  const callerId = process.env.TWILIO_CALLER_ID!;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${origin}/api/voice/recording" recordingStatusCallbackEvent="completed">
    <Number url="${origin}/api/voice/whisper">${to}</Number>
  </Dial>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
