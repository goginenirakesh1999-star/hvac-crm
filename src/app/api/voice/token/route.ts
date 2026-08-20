import { NextResponse } from "next/server";
import twilio from "twilio";
import { createServerSupabase } from "@/lib/supabase/server";

// Mints a short-lived Twilio Voice access token for the signed-in agent.
// The token identity IS the agent's user id, so every call they place is
// attributable to them in Twilio's logs and in the outbound route.
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY_SID!,
    process.env.TWILIO_API_KEY_SECRET!,
    { identity: user.id, ttl: 3600 }
  );
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      incomingAllow: false,
    })
  );

  return NextResponse.json({ identity: user.id, token: token.toJwt() });
}
