"use client";

import { fmtETDay, fmtETTime, fmtETFull, isETToday, etDayStart } from "@/lib/time";

import { useEffect, useRef, useState } from "react";
import { useDialer } from "@/lib/useDialer";
import { createClient } from "@/lib/supabase/client";
import Quote from "../Quote";
import SideNav from "../SideNav";
import BookCall from "../BookCall";
import "../call/call.css";

interface Appt {
  id: string;
  prospect_name: string | null;
  prospect_business: string | null;
  prospect_phone: string;
  prospect_email: string | null;
  scheduled_at: string;
  notes: string | null;
  status: string;
  outcome_notes: string | null;
  twilio_call_sid: string | null;
  booked_by: string;
}

function normalize(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}
function dayLabel(iso: string): string {
  const d = new Date(iso), today = new Date(), tom = new Date();
  tom.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, tom)) return "Tomorrow";
  return fmtETDay(iso);
}
function relTime(iso: string): { text: string; soon: boolean; over: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const m = Math.round(Math.abs(diff) / 60000);
  const s = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  if (diff < -60000) return { text: `overdue ${s}`, soon: false, over: true };
  if (diff < 60000) return { text: "now", soon: true, over: false };
  return { text: `in ${s}`, soon: diff < 30 * 60000, over: false };
}
const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", won: "Won ✓", lost: "Lost", no_show: "No-show" };

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [callsToday, setCallsToday] = useState(0);
  const [, setTick] = useState(0); // re-render for live countdowns
  const activeApptRef = useRef<Appt | null>(null);
  const [activeName, setActiveName] = useState("");
  const supabase = createClient();

  const dialer = useDialer(({ durationSec, callSid }) => {
    const appt = activeApptRef.current;
    activeApptRef.current = null;
    if (appt && callSid) {
      fetch(`/api/appointments/${appt.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twilio_call_sid: callSid }),
      }).catch(() => {});
      fetch("/api/calls/log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealership_name: appt.prospect_name || appt.prospect_business || appt.prospect_phone,
          dealership_phone: appt.prospect_phone, twilio_call_sid: callSid,
          status: durationSec > 0 ? "completed" : "no-answer", duration_seconds: durationSec, outcome: "Closer call",
        }),
      }).catch(() => {});
      setCallsToday((n) => n + 1);
    }
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const body = await res.json();
      if (body.ok) setAppts(body.appointments as Appt[]);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const since = etDayStart();
        const { count } = await supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
        setCallsToday(count ?? 0);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => {
    load();
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function callProspect(a: Appt) {
    if (dialer.status !== "idle") return;
    activeApptRef.current = a;
    setActiveName(a.prospect_name || a.prospect_business || a.prospect_phone);
    dialer.call(normalize(a.prospect_phone));
  }
  async function mark(a: Appt, status: string) {
    await fetch(`/api/appointments/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, outcome_notes: note[a.id] ?? a.outcome_notes ?? "" }),
    });
    setAppts((prev) => prev.map((x) => (x.id === a.id ? { ...x, status, outcome_notes: note[a.id] ?? x.outcome_notes } : x)));
  }

  const q = query.trim().toLowerCase();
  const match = (a: Appt) => !q || `${a.prospect_business ?? ""} ${a.prospect_name ?? ""} ${a.prospect_phone}`.toLowerCase().includes(q);
  const upcoming = appts.filter((a) => a.status === "scheduled" && match(a));
  const done = appts.filter((a) => a.status !== "scheduled" && match(a));

  const isToday = (iso: string) => isETToday(iso);
  const todayCount = appts.filter((a) => a.status === "scheduled" && isToday(a.scheduled_at)).length;
  const wonCount = appts.filter((a) => a.status === "won").length;
  const lostCount = appts.filter((a) => a.status === "lost" || a.status === "no_show").length;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

  const groups: { label: string; items: Appt[] }[] = [];
  for (const a of upcoming) {
    const label = dayLabel(a.scheduled_at);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(a); else groups.push({ label, items: [a] });
  }

  const mm = String(Math.floor(dialer.seconds / 60)).padStart(2, "0");
  const ss = String(dialer.seconds % 60).padStart(2, "0");
  const time = (iso: string) => fmtETTime(iso);

  return (
    <>
    <SideNav />
    <div className="cp with-nav" style={{ ["--wall" as string]: "url(/wallpapers/focus3.jpg)" } as React.CSSProperties}>
      <div className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-mark" src="/logo-mark.png" alt="Rocky Solutions LLC" />
          <div>
          <h1>Closer — Appointments</h1>
          <div className="sub">Booked by the callers. Call at the slot and mark the result.</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" onClick={load}>Refresh</button>
          <BookCall label="📆 Schedule meeting" className="btn-ghost" />
        </div>
      </div>

      <Quote />
      {dialer.error && <div className="banner">{dialer.error}</div>}

      {/* Scoreboard */}
      <div className="stats">
        <div className="stat"><div className="stat-n">{todayCount}</div><div className="stat-l">📅 Today</div></div>
        <div className="stat"><div className="stat-n">{upcoming.length}</div><div className="stat-l">⏳ Upcoming</div></div>
        <div className="stat good"><div className="stat-n">{wonCount}</div><div className="stat-l">🏆 Won</div></div>
        <div className="stat"><div className="stat-n">{winRate}<span className="stat-u">%</span></div><div className="stat-l">🎯 Win rate</div></div>
        <div className="stat"><div className="stat-n">{callsToday}</div><div className="stat-l">📞 Calls today</div></div>
      </div>

      {/* Live call bar */}
      {dialer.status !== "idle" && (
        <div className="panel callbar">
          <div>
            <div className="callee">{activeName}</div>
            <div className={dialer.status === "live" ? "status live" : "status"}>{dialer.status === "live" ? `● On call ${mm}:${ss}` : "Connecting…"}</div>
          </div>
          <div className="controls">
            {dialer.status === "live" && <button className="btn-ghost" onClick={dialer.toggleMute}>{dialer.muted ? "Unmute" : "Mute"}</button>}
            <button className="btn-red" onClick={dialer.hangup}>{dialer.status === "live" ? "Hang up" : "Cancel"}</button>
          </div>
        </div>
      )}

      <input className="search" placeholder="🔎 Search prospect or number…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 360 }} />

      {loading && <div className="panel empty">Loading…</div>}
      {!loading && !upcoming.length && <div className="panel empty">🎉 No upcoming appointments. Callers will book them here.</div>}

      {groups.map((g) => (
        <div key={g.label} className="panel">
          <h2>{g.label}</h2>
          {g.items.map((a) => {
            const r = relTime(a.scheduled_at);
            return (
              <div key={a.id} className="appt">
                <div className="appt-when">
                  {time(a.scheduled_at)}
                  <div className={`when-rel ${r.over ? "over" : r.soon ? "soon" : ""}`}>{r.text}</div>
                </div>
                <div className="appt-main">
                  <div className="nm">{a.prospect_name || "—"} {a.prospect_business && <span className="muted">· {a.prospect_business}</span>}</div>
                  <div className="ph">{a.prospect_phone}{a.prospect_email ? ` · ${a.prospect_email}` : ""} · booked by {a.booked_by || "—"}</div>
                  {a.notes && <div className="appt-notes">{a.notes}</div>}
                  <input placeholder="Outcome notes…" value={note[a.id] ?? a.outcome_notes ?? ""} onChange={(e) => setNote({ ...note, [a.id]: e.target.value })} style={{ marginTop: 8 }} />
                  <div className="actions" style={{ margin: "10px 0 0" }}>
                    <button className="btn-green" disabled={dialer.status !== "idle"} onClick={() => callProspect(a)}>Call</button>
                    <button className="btn-blue" onClick={() => mark(a, "won")}>Won</button>
                    <button className="btn-ghost" onClick={() => mark(a, "lost")}>Lost</button>
                    <button className="btn-ghost" onClick={() => mark(a, "no_show")}>No-show</button>
                    <BookCall ctx={{ name: a.prospect_name, email: a.prospect_email, business: a.prospect_business, phone: a.prospect_phone }} label="📆 Invite" className="btn-ghost" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {done.length > 0 && (
        <div className="panel">
          <h2>Recently closed ({done.length})</h2>
          <div className="tbl-scroll">
            <table>
              <thead><tr><th>When</th><th>Prospect</th><th>Phone</th><th>Result</th><th>Notes</th><th>Recording</th></tr></thead>
              <tbody>
                {done.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtETFull(a.scheduled_at)}</td>
                    <td>{a.prospect_name || "—"}<br /><span className="ph">{a.prospect_business}</span></td>
                    <td>{a.prospect_phone}</td>
                    <td>{STATUS_LABEL[a.status] ?? a.status}</td>
                    <td className="notes">{a.outcome_notes || "—"}</td>
                    <td>{a.twilio_call_sid ? <a href={`/api/voice/recording-media?callSid=${a.twilio_call_sid}`} target="_blank" rel="noreferrer">▶ Play</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
