import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CallLogUpdate = Database["public"]["Tables"]["call_logs"]["Update"];

interface LogBody {
  dealership_name?: string;
  dealership_phone?: string;
  twilio_call_sid?: string;
  status?: string;
  duration_seconds?: number;
  outcome?: string;
  notes?: string;
  is_conversion?: boolean;
  lead_id?: string;
}

// Persists one finished call, attributed to the signed-in agent. The agent_id
// comes from the session, never the client, so a rep can only log their own calls.
//
// Upserts on twilio_call_sid: the console logs every call the moment it ends, so
// nothing depends on the rep remembering to disposition it. When they do pick an
// outcome afterwards, that second POST carries the same CallSid and updates the
// existing row rather than creating a duplicate. Fields that arrive empty on the
// later call never overwrite what the first one already stored.
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  let body: LogBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  if (!body.dealership_phone) {
    return NextResponse.json({ ok: false, error: "dealership_phone required" }, { status: 422 });
  }

  // Same call already logged? Update it instead of inserting a twin.
  if (body.twilio_call_sid) {
    const { data: existing } = await supabase
      .from("call_logs")
      .select("id")
      .eq("agent_id", user.id)
      .eq("twilio_call_sid", body.twilio_call_sid)
      .maybeSingle();

    if (existing) {
      const patch: CallLogUpdate = {};
      if (body.dealership_name) patch.dealership_name = body.dealership_name;
      if (body.dealership_phone) patch.dealership_phone = body.dealership_phone;
      if (body.status) patch.status = body.status;
      if (body.duration_seconds) patch.duration_seconds = body.duration_seconds;
      if (body.outcome) patch.outcome = body.outcome;
      if (body.notes) patch.notes = body.notes;
      if (body.lead_id) patch.lead_id = body.lead_id;
      if (body.is_conversion !== undefined) patch.is_conversion = body.is_conversion;

      const { error: upErr } = await supabase.from("call_logs").update(patch).eq("id", existing.id);
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: existing.id, updated: true });
    }
  }

  const { data, error } = await supabase
    .from("call_logs")
    .insert({
      agent_id: user.id,
      dealership_name: body.dealership_name ?? null,
      dealership_phone: body.dealership_phone,
      twilio_call_sid: body.twilio_call_sid ?? null,
      status: body.status ?? null,
      duration_seconds: body.duration_seconds ?? 0,
      outcome: body.outcome ?? null,
      notes: body.notes ?? null,
      is_conversion: body.is_conversion ?? false,
      lead_id: body.lead_id ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}
