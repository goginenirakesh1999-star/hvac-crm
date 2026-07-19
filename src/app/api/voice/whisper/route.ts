import { NextResponse } from "next/server";

// Played to the called party before they're bridged in — recording consent.
function twiml() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This call may be recorded for quality and training purposes.</Say>
</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

export async function POST() {
  return twiml();
}
export async function GET() {
  return twiml();
}
