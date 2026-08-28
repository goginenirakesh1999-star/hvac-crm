import { createServerSupabase } from "@/lib/supabase/server";
import type { AgentRole } from "@/lib/database.types";
import LeadManager from "./LeadManager";
import Quote from "../Quote";
import "../call/call.css";

export const dynamic = "force-dynamic";

interface AgentRow {
  id: string;
  agent: string;
  role: AgentRole;
  number: string | null;
  calls: number;
  connects: number;
  conversions: number;
  talkMin: number;
  target: number;
}

interface CallRow {
  id: string;
  agentName: string;
  at: string;
  name: string | null;
  phone: string;
  duration: number;
  outcome: string | null;
  notes: string | null;
  callSid: string | null;
  conversion: boolean;
}

const RANGES: Record<string, { label: string; hours: number }> = {
  today: { label: "Today", hours: 0 },
  "7d": { label: "Last 7 days", hours: 24 * 7 },
  "30d": { label: "Last 30 days", hours: 24 * 30 },
};

function rangeStart(key: string): string {
  const now = new Date();
  if (key === "today") {
    now.setUTCHours(0, 0, 0, 0);
    return now.toISOString();
  }
  return new Date(Date.now() - RANGES[key].hours * 3600_000).toISOString();
}

// A per-agent progress table for one job type (callers or closers).
function AgentTable({ title, rows, showTarget }: { title: string; rows: AgentRow[]; showTarget: boolean }) {
  return (
    <div className="panel">
      <h2>{title} ({rows.length})</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th>{title.replace(/s$/, "")}</th>
            <th>{showTarget ? "Calls / target" : "Calls"}</th>
            <th>Connected</th>
            <th>Conversions</th>
            <th>Talk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = showTarget ? Math.min(100, Math.round((r.calls / Math.max(1, r.target)) * 100)) : 0;
            return (
              <tr key={r.id}>
                <td>
                  <div className="nm">{r.agent}</div>
                  {r.number && <div className="ph">{r.number}</div>}
                </td>
                <td>
                  {showTarget ? (
                    <div className="prog-wrap">
                      <div className="prog"><span style={{ width: `${pct}%` }} className={pct >= 100 ? "bar full" : "bar"} /></div>
                      <span className="prog-txt">{r.calls} / {r.target}</span>
                    </div>
                  ) : (
                    r.calls
                  )}
                </td>
                <td>{r.connects}</td>
                <td><strong className="conv">{r.conversions}</strong></td>
                <td>{r.talkMin}m</td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={5} className="muted">No {title.toLowerCase()} yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  if (me?.role !== "admin") {
    return (
      <div className="cp">
        <div className="topbar">
          <h1>Dashboard</h1>
          <form action="/api/auth/signout" method="post">
            <button className="btn-ghost" type="submit">Sign out</button>
          </form>
        </div>
        <div className="banner">This page is for managers only.</div>
      </div>
    );
  }

  const requested = (await searchParams).range;
  const rangeKey = requested && RANGES[requested] ? requested : "today";
  const since = rangeStart(rangeKey);

  const nowIso = new Date().toISOString();
  const [{ data: agents }, { data: calls }, { data: apptBooked }, { data: apptUpcoming }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, daily_call_target, twilio_number").order("full_name"),
    supabase
      .from("call_logs")
      .select("id, agent_id, dealership_name, dealership_phone, duration_seconds, outcome, notes, twilio_call_sid, is_conversion, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase.from("appointments").select("id, status, created_at").gte("created_at", since),
    supabase
      .from("appointments")
      .select("id, prospect_name, prospect_business, prospect_phone, scheduled_at, notes, status")
      .eq("status", "scheduled")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(20),
  ]);

  const apptBookedCount = (apptBooked ?? []).length;
  const apptWonCount = (apptBooked ?? []).filter((a) => a.status === "won").length;

  const nameOf = new Map((agents ?? []).map((a) => [a.id, a.full_name ?? a.id.slice(0, 8)]));

  const rows: AgentRow[] = (agents ?? []).map((a) => {
    const mine = (calls ?? []).filter((c) => c.agent_id === a.id);
    return {
      id: a.id,
      agent: a.full_name ?? a.id.slice(0, 8),
      role: (a.role ?? "agent") as AgentRole,
      number: a.twilio_number,
      calls: mine.length,
      connects: mine.filter((c) => (c.duration_seconds ?? 0) > 0).length,
      conversions: mine.filter((c) => c.is_conversion).length,
      talkMin: Math.round(mine.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60),
      target: a.daily_call_target ?? 40,
    };
  });

  // Legacy 'agent' counts as a caller; admins are managers, not on the floor.
  const callers = rows.filter((r) => r.role === "caller" || r.role === "agent");
  const closers = rows.filter((r) => r.role === "closer");

  const detail: CallRow[] = (calls ?? []).slice(0, 300).map((c) => ({
    id: c.id,
    agentName: nameOf.get(c.agent_id) ?? c.agent_id.slice(0, 8),
    at: new Date(c.created_at).toLocaleString(),
    name: c.dealership_name,
    phone: c.dealership_phone,
    duration: c.duration_seconds ?? 0,
    outcome: c.outcome,
    notes: c.notes,
    callSid: c.twilio_call_sid,
    conversion: c.is_conversion,
  }));

  const staffRows = [...callers, ...closers];
  const totals = staffRows.reduce(
    (t, r) => ({
      calls: t.calls + r.calls,
      connects: t.connects + r.connects,
      conversions: t.conversions + r.conversions,
      talkMin: t.talkMin + r.talkMin,
    }),
    { calls: 0, connects: 0, conversions: 0, talkMin: 0 }
  );

  const showTarget = rangeKey === "today";

  return (
    <div className="cp" style={{ ["--wall" as string]: "url(/wallpapers/midnight2.jpg)" } as React.CSSProperties}>
      <div className="topbar">
        <div>
          <h1>Team Dashboard</h1>
          <div className="sub">
            {RANGES[rangeKey].label} · conversion = &quot;Sending denials&quot;
          </div>
        </div>
        <div className="topbar-actions">
          <div className="segmented">
            {Object.entries(RANGES).map(([k, v]) => (
              <a key={k} href={`/admin?range=${k}`} className={k === rangeKey ? "seg on" : "seg"}>
                {v.label}
              </a>
            ))}
          </div>
          <a className="btn-ghost" href="/call">Console</a>
          <form action="/api/auth/signout" method="post">
            <button className="btn-ghost" type="submit">Sign out</button>
          </form>
        </div>
      </div>

      <Quote />

      {/* Summary stat cards */}
      <div className="stats">
        <div className="stat"><div className="stat-n">{totals.calls}</div><div className="stat-l">Calls</div></div>
        <div className="stat"><div className="stat-n">{totals.connects}</div><div className="stat-l">Connected</div></div>
        <div className="stat good"><div className="stat-n">{totals.conversions}</div><div className="stat-l">Conversions</div></div>
        <div className="stat"><div className="stat-n">{totals.talkMin}<span className="stat-u">m</span></div><div className="stat-l">Talk time</div></div>
        <div className="stat"><div className="stat-n">{apptBookedCount}</div><div className="stat-l">Appts booked</div></div>
        <div className="stat good"><div className="stat-n">{apptWonCount}</div><div className="stat-l">Deals won</div></div>
      </div>

      {/* Lead pipeline: upload/assign, funnel counts, tracker */}
      <LeadManager callers={callers.map((c) => ({ id: c.id, name: c.agent }))} />

      {/* Per-role progress */}
      <AgentTable title="Callers" rows={callers} showTarget={showTarget} />
      <AgentTable title="Closers" rows={closers} showTarget={showTarget} />

      {/* Upcoming appointments the closer will work */}
      <div className="panel">
        <h2>Upcoming appointments ({(apptUpcoming ?? []).length})</h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>When</th><th>Prospect</th><th>Phone</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {(apptUpcoming ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{new Date(a.scheduled_at).toLocaleString()}</td>
                  <td>{a.prospect_name || "—"}<br /><span className="ph">{a.prospect_business}</span></td>
                  <td>{a.prospect_phone}</td>
                  <td className="notes">{a.notes || "—"}</td>
                </tr>
              ))}
              {!(apptUpcoming ?? []).length && <tr><td colSpan={4} className="muted">No upcoming appointments.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed call log with notes + recordings */}
      <div className="panel">
        <h2>Call activity ({detail.length})</h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Agent</th><th>Time</th><th>Business</th><th>Dur</th><th>Outcome</th><th>Notes</th><th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((c) => (
                <tr key={c.id} className={c.conversion ? "conv-row" : ""}>
                  <td>{c.agentName}</td>
                  <td className="nowrap">{c.at}</td>
                  <td>{c.name || "—"}<br /><span className="ph">{c.phone}</span></td>
                  <td>{c.duration}s</td>
                  <td>{c.outcome || "—"}</td>
                  <td className="notes">{c.notes || "—"}</td>
                  <td>
                    {c.callSid ? (
                      <a href={`/api/voice/recording-media?callSid=${c.callSid}`} target="_blank" rel="noreferrer">▶ Play</a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {!detail.length && <tr><td colSpan={7} className="muted">No calls in this range.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="hint">Recordings take a few seconds to process after hang-up before playback works.</div>
      </div>
    </div>
  );
}
