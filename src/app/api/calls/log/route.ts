import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
