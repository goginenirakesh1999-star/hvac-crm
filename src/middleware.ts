import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Session refresh + auth gating for the calling console, admin dashboard, and
// Twilio token endpoints. See src/lib/supabase/middleware.ts for the logic.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/call/:path*",
    "/admin/:path*",
    "/appointments/:path*",
    "/api/appointments/:path*",
    "/api/voice/token",
    "/api/voice/recording-media",
  ],
};
