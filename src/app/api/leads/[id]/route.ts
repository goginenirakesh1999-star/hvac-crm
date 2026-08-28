import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database, LeadStatus } from "@/lib/database.types";

type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

const STATUSES = new Set<LeadStatus>([
  "new", "attempted", "contacted", "callback", "appointment", "won", "lost", "dnc",
]);

interface Body {
  status?: LeadStatus;
  notes?: string;
  callback_at?: string | null;
  attempts?: number;
  last_contacted_at?: string;
  assigned_to?: string | null;
}

// PATCH: a caller updates their lead after a call (disposition, notes, callback),
// or an admin edits any lead. RLS enforces ownership.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const patch: LeadUpdate = {};
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ ok: false, error: "invalid status" }, { status: 422 });
    patch.status = body.status;
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.callback_at !== undefined) patch.callback_at = body.callback_at;
  if (body.attempts !== undefined) patch.attempts = body.attempts;
  if (body.last_contacted_at !== undefined) patch.last_contacted_at = body.last_contacted_at;
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to;

  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
