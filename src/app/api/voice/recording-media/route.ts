import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

// Streams a call's recording audio (with server-side auth) so the report
// can play it back. Usage: /api/voice/recording-media?callSid=CAxxxx
export async function GET(req: NextRequest) {
  const callSid = new URL(req.url).searchParams.get("callSid");
  if (!callSid) return new NextResponse("callSid required", { status: 400 });

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const tok = process.env.TWILIO_AUTH_TOKEN!;
  const client = twilio(sid, tok);

  const recs = await client.recordings.list({ callSid, limit: 1 });
  if (!recs.length) return new NextResponse("no recording yet", { status: 404 });

  const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${recs[0].sid}.mp3`;
  const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
  const upstream = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("recording not available", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
}
