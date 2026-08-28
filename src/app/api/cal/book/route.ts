import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// The client-facing event type on Cal.com. 6852306 = "Quick Intro of the
// services" (matches the booking link). Swap to 6459907 for "Warranty claim
// review" if that fits better.
const CAL_EVENT_TYPE_ID = 6852306;

interface Body {
  name?: string;
  email?: string;
  phone?: string;
  business?: string;
  notes?: string;
  start?: string; // wall-clock "YYYY-MM-DDTHH:mm" in `timeZone`
  timeZone?: string;
  leadId?: string;
}

// Interpret a wall-clock local time as being in `tz` and return the UTC ISO.
function zonedToUtc(local: string, tz: string): string {
  const asIfUtc = new Date(`${local}:00Z`).getTime();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(asIfUtc)).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour === 24 ? 0 : +parts.hour, +parts.minute, +parts.second);
  const offset = shown - asIfUtc;
  return new Date(asIfUtc - offset).toISOString();
}

// Books a client meeting via Cal.com (Cal sends the client the confirmation +
// Google Meet link and puts it on the owner's one calendar), then records it in
// our appointments table attributed to the signed-in caller/closer.
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch { return new NextResponse("bad json", { status: 400 }); }
  if (!body.email) return NextResponse.json({ ok: false, error: "Client email is required — Cal sends their invite there." }, { status: 422 });
  if (!body.start) return NextResponse.json({ ok: false, error: "Pick a date & time." }, { status: 422 });

  const key = process.env.CAL_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "CAL_API_KEY is not set on the server." }, { status: 500 });

  const tz = body.timeZone || "America/New_York";
  const startUtc = zonedToUtc(body.start, tz);

  const calRes = await fetch("https://api.cal.com/v2/bookings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
    body: JSON.stringify({
      start: startUtc,
      eventTypeId: CAL_EVENT_TYPE_ID,
      attendee: { name: body.name || body.email, email: body.email, timeZone: tz, language: "en" },
      ...(body.notes ? { bookingFieldsResponses: { notes: body.notes } } : {}),
    }),
  });
  const cal = await calRes.json().catch(() => ({}));
  if (cal?.status !== "success") {
    return NextResponse.json({ ok: false, error: cal?.error?.message || "Cal.com could not book that slot." }, { status: 400 });
  }
  const uid = cal?.data?.uid as string | undefined;

  // Record in our system so caller/closer/admin see it in-app.
  await supabase.from("appointments").insert({
    created_by: user.id,
    prospect_name: body.name || null,
    prospect_business: body.business || null,
    prospect_phone: body.phone || body.email,
    prospect_email: body.email,
    scheduled_at: startUtc,
    notes: `Cal.com${uid ? " #" + uid : ""}${body.notes ? " · " + body.notes : ""}`,
    lead_id: body.leadId || null,
  });
  if (body.leadId) {
    await supabase.from("leads").update({ status: "appointment", email: body.email }).eq("id", body.leadId);
  }

  return NextResponse.json({ ok: true, uid });
}
