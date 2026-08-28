"use client";

import { useEffect, useRef, useState } from "react";
import { useDialer } from "@/lib/useDialer";
import Quote from "../Quote";
import "../call/call.css";

interface Appt {
  id: string;
  prospect_name: string | null;
  prospect_business: string | null;
  prospect_phone: string;
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
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  won: "Won ✓",
  lost: "Lost",
  no_show: "No-show",
};

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<Record<string, string>>({});
  const activeApptRef = useRef<Appt | null>(null);
  const [activeName, setActiveName] = useState("");

  const dialer = useDialer(({ durationSec, callSid }) => {
    const appt = activeApptRef.current;
    activeApptRef.current = null;
    if (appt && callSid) {
      // attach the closer's call recording to the appointment
      fetch(`/api/appointments/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twilio_call_sid: callSid }),
      }).catch(() => {});
      // also log it as a call so it shows in the admin's Call Activity (with recording)
      fetch("/api/calls/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealership_name: appt.prospect_name || appt.prospect_business || appt.prospect_phone,
          dealership_phone: appt.prospect_phone,
          twilio_call_sid: callSid,
          status: durationSec > 0 ? "completed" : "no-answer",
          duration_seconds: durationSec,
          outcome: "Closer call",
        }),
      }).catch(() => {});
    }
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const body = await res.json();
      if (body.ok) setAppts(body.appointments as Appt[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function callProspect(a: Appt) {
    if (dialer.status !== "idle") return;
    activeApptRef.current = a;
    setActiveName(a.prospect_name || a.prospect_business || a.prospect_phone);
    dialer.call(normalize(a.prospect_phone), true);
  }

  async function mark(a: Appt, status: string) {
    await fetch(`/api/appointments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, outcome_notes: note[a.id] ?? a.outcome_notes ?? "" }),
    });
    setAppts((prev) => prev.map((x) => (x.id === a.id ? { ...x, status, outcome_notes: note[a.id] ?? x.outcome_notes } : x)));
  }

  const upcoming = appts.filter((a) => a.status === "scheduled");
  const done = appts.filter((a) => a.status !== "scheduled");

  // group upcoming by day
  const groups: { label: string; items: Appt[] }[] = [];
  for (const a of upcoming) {
    const label = dayLabel(a.scheduled_at);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(a);
    else groups.push({ label, items: [a] });
  }

  const mm = String(Math.floor(dialer.seconds / 60)).padStart(2, "0");
  const ss = String(dialer.seconds % 60).padStart(2, "0");
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="cp" style={{ ["--wall" as string]: "url(/wallpapers/focus3.jpg)" } as React.CSSProperties}>
      <div className="topbar">
        <div>
          <h1>Closer — Appointments</h1>
          <div className="sub">Booked by the callers. Call at the slot and mark the result.</div>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" onClick={load}>Refresh</button>
          <form action="/api/auth/signout" method="post">
            <button className="btn-ghost" type="submit">Sign out</button>
          </form>
        </div>
      </div>

      <Quote />
      {dialer.error && <div className="banner">{dialer.error}</div>}

      {/* Live call bar */}
      {dialer.status !== "idle" && (
        <div className="panel callbar">
          <div>
            <div className="callee">{activeName}</div>
            <div className={dialer.status === "live" ? "status live" : "status"}>
              {dialer.status === "live" ? `● On call ${mm}:${ss}` : "Connecting…"}
            </div>
          </div>
          <div className="controls">
            {dialer.status === "live" && <button className="btn-ghost" onClick={dialer.toggleMute}>{dialer.muted ? "Unmute" : "Mute"}</button>}
            <button className="btn-red" onClick={dialer.hangup}>{dialer.status === "live" ? "Hang up" : "Cancel"}</button>
          </div>
        </div>
      )}

      {loading && <div className="panel muted">Loading…</div>}
      {!loading && !upcoming.length && <div className="panel muted">No upcoming appointments. Callers will book them here.</div>}

      {groups.map((g) => (
        <div key={g.label} className="panel">
          <h2>{g.label}</h2>
          {g.items.map((a) => (
            <div key={a.id} className="appt">
              <div className="appt-when">{time(a.scheduled_at)}</div>
              <div className="appt-main">
                <div className="nm">{a.prospect_name || "—"} {a.prospect_business && <span className="muted">· {a.prospect_business}</span>}</div>
                <div className="ph">{a.prospect_phone} · booked by {a.booked_by || "—"}</div>
                {a.notes && <div className="appt-notes">{a.notes}</div>}
                <input
                  placeholder="Outcome notes…"
                  value={note[a.id] ?? a.outcome_notes ?? ""}
                  onChange={(e) => setNote({ ...note, [a.id]: e.target.value })}
                  style={{ marginTop: 8 }}
                />
                <div className="actions" style={{ margin: "10px 0 0" }}>
                  <button className="btn-green" disabled={dialer.status !== "idle"} onClick={() => callProspect(a)}>Call</button>
                  <button className="btn-blue" onClick={() => mark(a, "won")}>Won</button>
                  <button className="btn-ghost" onClick={() => mark(a, "lost")}>Lost</button>
                  <button className="btn-ghost" onClick={() => mark(a, "no_show")}>No-show</button>
                </div>
              </div>
            </div>
          ))}
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
                    <td className="nowrap">{new Date(a.scheduled_at).toLocaleString()}</td>
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
  );
}
