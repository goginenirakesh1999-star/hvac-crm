import { NextRequest, NextResponse } from "next/server";

// Recording status callback. Twilio stores the recording; we just log it.
// (The /call report fetches playback on demand via /api/voice/recording-media.)
export async function POST(req: NextRequest) {
  const form = await req.formData();
  console.log(
    "recording ready:",
    form.get("CallSid"),
    form.get("RecordingSid"),
    form.get("RecordingDuration") + "s"
  );
  return new NextResponse(null, { status: 204 });
}
