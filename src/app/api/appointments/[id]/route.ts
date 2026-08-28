import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, LeadStatus } from "@/lib/database.types";

type ApptUpdate = Database["public"]["Tables"]["appointments"]["Update"];

// how an appointment result maps onto the linked lead's pipeline stage
const LEAD_STAGE: Record<string, LeadStatus> = { won: "won", lost: "lost", no_show: "lost" };

const STATUSES = new Set(["scheduled", "won", "lost", "no_show"]);

interface UpdateBody {
  status?: string;
  outcome_notes?: string;
  twilio_call_sid?: string;
}

// PATCH: the closer (or an admin) records the result of a close attempt.
// RLS on appointments restricts this to closer/admin; we also stamp closed_by.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const patch: ApptUpdate = { closed_by: user.id };
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ ok: false, error: "invalid status" }, { status: 422 });
    }
    patch.status = body.status;
  }
  if (body.outcome_notes !== undefined) patch.outcome_notes = body.outcome_notes;
  if (body.twilio_call_sid !== undefined) patch.twilio_call_sid = body.twilio_call_sid;

  const { error } = await supabase.from("appointments").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Mirror the result onto the linked lead's stage. The closer doesn't own the
  // lead, so this runs with the service role.
  if (body.status && LEAD_STAGE[body.status]) {
    const admin = createAdminClient();
    const { data: appt } = await admin.from("appointments").select("lead_id").eq("id", id).maybeSingle();
    if (appt?.lead_id) {
      await admin.from("leads").update({ status: LEAD_STAGE[body.status] }).eq("id", appt.lead_id);
    }
  }

  return NextResponse.json({ ok: true });
}
