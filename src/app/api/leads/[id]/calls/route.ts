import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET the call history for one lead. RLS scopes rows: a caller sees calls on
// their own leads; an admin sees all. Newest first.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("call_logs")
    .select("id, created_at, outcome, duration_seconds, notes, twilio_call_sid")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, calls: data ?? [] });
}
