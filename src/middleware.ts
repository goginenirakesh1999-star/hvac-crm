import { NextRequest, NextResponse } from "next/server";

/**
 * Gates the call console and the Twilio token endpoint behind a passcode.
 *
 * Without this, a public deployment hands anyone who finds /api/voice/token a valid
 * Twilio Voice grant — meaning they can place calls on the account and spend the balance.
 * Token endpoints get scanned; this is not a hypothetical.
 *
 * Twilio's own webhooks (/api/voice/outbound, /whisper, /recording) are deliberately NOT
 * matched here — Twilio cannot present a passcode. Those are protected instead by
 * X-Twilio-Signature validation, which needs WEBHOOK_BASE_URL set in production.
 */

const REALM = 'Basic realm="Rocky Solutions Call Console", charset="UTF-8"';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

export function middleware(req: NextRequest) {
  const expected = process.env.DIALER_PASSCODE;

  // No passcode configured: fine locally, never in production.
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "DIALER_PASSCODE is not set. Refusing to expose the dialer without it.",
        { status: 503 }
      );
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  // Any username; the passcode is the secret.
  const passcode = decoded.slice(decoded.indexOf(":") + 1);
  if (!constantTimeEqual(passcode, expected)) return unauthorized();

  return NextResponse.next();
}

export const config = {
  matcher: ["/call/:path*", "/api/voice/token", "/api/voice/recording-media"],
};
