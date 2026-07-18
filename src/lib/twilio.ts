import "server-only";
import twilio from "twilio";

export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

export async function sendSms(to: string, from: string, body: string) {
  return getTwilioClient().messages.create({ to, from, body });
}

// Verifies X-Twilio-Signature. Returns true when WEBHOOK_BASE_URL is unset
// (local development) so the routes still work before the deploy URL exists.
export function isValidTwilioRequest(
  signature: string | null,
  path: string,
  params: Record<string, string>
): boolean {
  const base = process.env.WEBHOOK_BASE_URL;
  if (!base) return true;
  if (!signature) return false;
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    `${base.replace(/\/$/, "")}${path}`,
    params
  );
}
