import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadStatus } from "@/lib/database.types";

// Tops every caller's queue back up to their daily target.
//
// Refined leads are seeded unassigned, tagged `pool:<caller name>` in `source`,
// with created_at written in score order — so "oldest first" out of the pool is
// "highest scoring first". A caller only ever sees their target-size working
// set; as leads close, the next best ones drop in.
//
// Called by the GitHub Actions schedule with the CRON_SECRET as a bearer token.
const OPEN_STATUSES: LeadStatus[] = ["new", "attempted", "callback"];

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Only callers with a caller ID are eligible to receive work.
  const { data: callers, error: cErr } = await db
    .from("profiles")
    .select("id, full_name, daily_call_target, twilio_number")
    .eq("role", "caller")
    .not("twilio_number", "is", null);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const report: Record<string, { open: number; target: number; assigned: number; poolLeft: number }> = {};

  for (const c of callers ?? []) {
    const name = c.full_name ?? "";
    const target = c.daily_call_target ?? 50;

    const { count: open } = await db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", c.id)
      .in("status", OPEN_STATUSES);

    const need = Math.max(0, target - (open ?? 0));

    let assigned = 0;
    if (need > 0) {
      const { data: next } = await db
        .from("leads")
        .select("id")
        .is("assigned_to", null)
        .eq("source", `pool:${name}`)
        .order("created_at", { ascending: true })
        .limit(need);

      const ids = (next ?? []).map((l) => l.id);
      if (ids.length) {
        const { error: uErr } = await db
          .from("leads")
          .update({ assigned_to: c.id })
          .in("id", ids);
        if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
        assigned = ids.length;
      }
    }

    const { count: poolLeft } = await db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("assigned_to", null)
      .eq("source", `pool:${name}`);

    report[name] = { open: open ?? 0, target, assigned, poolLeft: poolLeft ?? 0 };
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString(), callers: report });
}

// Same work, for a manual browser/curl check.
export async function GET(req: NextRequest) {
  return POST(req);
}
