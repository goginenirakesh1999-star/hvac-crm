import { NextResponse } from "next/server";
import twilio from "twilio";

// Mints a short-lived Twilio Voice access token for the browser softphone.
export async function GET() {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const identity = "rocky-agent";

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY_SID!,
    process.env.TWILIO_API_KEY_SECRET!,
    { identity, ttl: 3600 }
  );
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      incomingAllow: false,
    })
  );

  return NextResponse.json({ identity, token: token.toJwt() });
}
