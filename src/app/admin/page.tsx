import { createServerSupabase } from "@/lib/supabase/server";
import "../call/call.css";

export const dynamic = "force-dynamic";

interface Row {
  agent: string;
  calls: number;
  connects: number;
  conversions: number;
  talkMin: number;
  target: number;
}

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware guarantees a session; this checks the admin role specifically.
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  if (me?.role !== "admin") {
    return (
      <div className="cp">
        <h1>Admin</h1>
        <div className="banner">This page is for admins only.</div>
      </div>
    );
  }

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0); // start of today (UTC)

  const { data: agents } = await supabase
    .from("profiles")
    .select("id, full_name, daily_call_target")
    .order("full_name");
  const { data: calls } = await supabase
    .from("call_logs")
    .select("agent_id, duration_seconds, is_conversion, created_at")
    .gte("created_at", since.toISOString());

  const rows: Row[] = (agents ?? []).map((a) => {
    const mine = (calls ?? []).filter((c) => c.agent_id === a.id);
    return {
      agent: a.full_name ?? a.id.slice(0, 8),
      calls: mine.length,
      connects: mine.filter((c) => (c.duration_seconds ?? 0) > 0).length,
      conversions: mine.filter((c) => c.is_conversion).length,
      talkMin: Math.round(mine.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60),
      target: a.daily_call_target ?? 40,
    };
  });

  const totals = rows.reduce(
    (t, r) => ({
      calls: t.calls + r.calls,
      connects: t.connects + r.connects,
      conversions: t.conversions + r.conversions,
      talkMin: t.talkMin + r.talkMin,
    }),
    { calls: 0, connects: 0, conversions: 0, talkMin: 0 }
  );

  return (
    <div className="cp">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Team Dashboard</h1>
          <div className="sub">Today (since 00:00 UTC). Conversion = &quot;Sending denials&quot;.</div>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="btn-ghost" type="submit">Sign out</button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Agent</th><th>Calls (target)</th><th>Connects</th><th>Conversions</th><th>Talk (min)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.agent}>
                <td>{r.agent}</td>
                <td>{r.calls} / {r.target}</td>
                <td>{r.connects}</td>
                <td><strong>{r.conversions}</strong></td>
                <td>{r.talkMin}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No agents yet.</td></tr>}
            {rows.length > 0 && (
              <tr>
                <td><strong>Team total</strong></td>
                <td><strong>{totals.calls}</strong></td>
                <td><strong>{totals.connects}</strong></td>
                <td><strong>{totals.conversions}</strong></td>
                <td><strong>{totals.talkMin}</strong></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
