import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CreateBody {
  prospect_name?: string;
  prospect_business?: string;
  prospect_phone?: string;
  prospect_email?: string;
  scheduled_at?: string;
  notes?: string;
  lead_id?: string;
}

// POST: a caller books an appointment (attributed to themselves via the session).
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  if (!body.prospect_phone) {
    return NextResponse.json({ ok: false, error: "prospect_phone required" }, { status: 422 });
  }
  if (!body.scheduled_at || Number.isNaN(Date.parse(body.scheduled_at))) {
    return NextResponse.json({ ok: false, error: "valid scheduled_at required" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      created_by: user.id,
      prospect_name: body.prospect_name ?? null,
      prospect_business: body.prospect_business ?? null,
      prospect_phone: body.prospect_phone,
      prospect_email: body.prospect_email ?? null,
      scheduled_at: new Date(body.scheduled_at).toISOString(),
      notes: body.notes ?? null,
      lead_id: body.lead_id ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Advance the linked lead into the appointment stage (caller owns it → RLS ok).
  if (body.lead_id) {
    await supabase.from("leads").update({ status: "appointment" }).eq("id", body.lead_id);
  }

  return NextResponse.json({ ok: true, id: data.id });
}

// GET: upcoming appointments the caller/closer/admin is allowed to see (RLS).
// Caller names are resolved with the service role since profile RLS hides other
// users' rows from a closer.
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: appts, error } = await supabase
    .from("appointments")
    .select("id, created_by, prospect_name, prospect_business, prospect_phone, prospect_email, scheduled_at, notes, status, outcome_notes, twilio_call_sid")
    .gte("scheduled_at", since)
    .order("scheduled_at", { ascending: true })
    .limit(300);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = [...new Set((appts ?? []).map((a) => a.created_by))];
  const nameOf = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await createAdminClient()
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of profs ?? []) nameOf.set(p.id, p.full_name ?? p.id.slice(0, 8));
  }

  const rows = (appts ?? []).map((a) => ({ ...a, booked_by: nameOf.get(a.created_by) ?? "" }));
  return NextResponse.json({ ok: true, appointments: rows });
}
