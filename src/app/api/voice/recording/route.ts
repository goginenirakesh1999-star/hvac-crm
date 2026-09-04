import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Recording status callback. Twilio stores the audio; we attach its SID to the
// matching call_log so every logged call carries its recording without anyone
// having to save it. Playback is fetched on demand via /api/voice/recording-media.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const callSid = String(form.get("CallSid") ?? "");
  const recordingSid = String(form.get("RecordingSid") ?? "");

  if (callSid && recordingSid) {
    try {
      await createAdminClient()
        .from("call_logs")
        .update({ recording_sid: recordingSid })
        .eq("twilio_call_sid", callSid);
    } catch {
      // A recording can land before the call row exists; the SID is still
      // recoverable from Twilio by CallSid, so this is not worth failing on.
    }
  }
  return new NextResponse(null, { status: 204 });
}
