import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/database.types";

interface NewLead {
  name?: string;
  business?: string;
  phone?: string;
}
interface CreateBody {
  leads?: NewLead[];
  assignTo?: string; // a caller's profile id, or "split"
}

// GET: admins get every lead (optionally filtered); callers get their own queue.
// Everything runs on the caller's own session — RLS scopes the rows, and an admin
// can read all profiles/leads — so no service-role key is required.
export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = me?.role === "admin";

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const assignedTo = url.searchParams.get("assigned_to");

  let q = supabase
    .from("leads")
    .select("id, assigned_to, name, business, phone, status, attempts, last_contacted_at, callback_at, notes, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (status) q = q.eq("status", status as LeadStatus);
  if (isAdmin && assignedTo) q = q.eq("assigned_to", assignedTo);

  const { data: leads, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // resolve caller names for the admin tracker (admins can read all profiles via RLS)
  let owners: Record<string, string> = {};
  if (isAdmin) {
    const ids = [...new Set((leads ?? []).map((l) => l.assigned_to).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      owners = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? p.id.slice(0, 8)]));
    }
  }

  const rows = (leads ?? []).map((l) => ({ ...l, owner: l.assigned_to ? owners[l.assigned_to] ?? "" : "" }));
  return NextResponse.json({ ok: true, role: me?.role ?? "agent", leads: rows });
}

// POST: admin bulk-creates leads and assigns them (to one caller or split evenly).
// Runs on the admin's session: RLS lets an admin read callers and insert leads.
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me) return new NextResponse("forbidden", { status: 403 });
  const isAdmin = me.role === "admin";

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const clean = (body.leads ?? []).filter((l) => l.phone && l.phone.replace(/\D/g, "").length >= 7);
  if (!clean.length) return NextResponse.json({ ok: false, error: "no valid leads (need phone numbers)" }, { status: 422 });

  // resolve assignment targets. Non-admins may only add leads to their own queue.
  let targets: (string | null)[] = [user.id];
  if (isAdmin) {
    if (body.assignTo === "split") {
      const { data: callers, error: ce } = await supabase.from("profiles").select("id").eq("role", "caller");
      if (ce) return NextResponse.json({ ok: false, error: ce.message }, { status: 500 });
      targets = (callers ?? []).map((c) => c.id);
      if (!targets.length) targets = [null];
    } else if (body.assignTo) {
      targets = [body.assignTo];
    } else {
      targets = [null];
    }
  }

  const rows = clean.map((l, i) => ({
    assigned_to: targets[i % targets.length],
    name: l.name ?? null,
    business: l.business ?? null,
    phone: l.phone!.trim(),
  }));
  const { error, count } = await supabase.from("leads").insert(rows, { count: "exact" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserted: count ?? rows.length });
}
