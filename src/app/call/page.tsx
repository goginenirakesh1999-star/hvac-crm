"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useDialer } from "@/lib/useDialer";
import { createClient } from "@/lib/supabase/client";
import type { LeadStatus } from "@/lib/database.types";
import Quote from "../Quote";
import SideNav from "../SideNav";
import BookCall from "../BookCall";
import "./call.css";

interface Lead {
  id: string;
  name: string | null;
  business: string | null;
  email: string | null;
  phone: string;
  status: LeadStatus;
  attempts: number;
  last_contacted_at: string | null;
  callback_at: string | null;
  notes: string | null;
}

const STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "b-new" },
  attempted: { label: "Attempted", cls: "b-att" },
  contacted: { label: "Contacted", cls: "b-con" },
  callback: { label: "Callback", cls: "b-cb" },
  appointment: { label: "Appointment", cls: "b-appt" },
  won: { label: "Won", cls: "b-won" },
  lost: { label: "Lost", cls: "b-lost" },
  dnc: { label: "DNC", cls: "b-lost" },
};

const DISPOSITIONS: { label: string; status: LeadStatus; callback?: boolean }[] = [
  { label: "No answer", status: "attempted" },
  { label: "Busy", status: "attempted" },
  { label: "Voicemail", status: "attempted" },
  { label: "Spoke — call back", status: "callback", callback: true },
  { label: "Spoke — interested", status: "contacted" },
  { label: "Gatekeeper", status: "contacted" },
  { label: "Not interested", status: "lost" },
  { label: "Do not call", status: "dnc" },
];

type Tab = "followup" | "new" | "working" | "all";

const US_TZ: [string, string][] = [
  ["America/New_York", "Eastern (ET)"],
  ["America/Chicago", "Central (CT)"],
  ["America/Denver", "Mountain (MT)"],
  ["America/Phoenix", "Arizona (MST)"],
  ["America/Los_Angeles", "Pacific (PT)"],
];

function normalize(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}
function parseRows(text: string): { name?: string; business?: string; phone: string }[] {
  const out: { name?: string; business?: string; phone: string }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const cells = line.split(/[,\t]/).map((c) => c.trim());
    let phone: string | null = null;
    const rest: string[] = [];
    for (const c of cells) {
      const n = normalize(c);
      if (n && !phone) phone = n;
      else if (c) rest.push(c);
    }
    if (phone) out.push({ business: rest[0], name: rest[1], phone });
  }
  return out;
}
const displayName = (l: Lead) => l.business || l.name || l.phone;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function CallPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<Tab>("followup");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialInput, setDialInput] = useState("");

  const [dispo, setDispo] = useState(DISPOSITIONS[0].label);
  const [dispoNotes, setDispoNotes] = useState("");
  const [callbackWhen, setCallbackWhen] = useState("");
  const [lastCall, setLastCall] = useState<{ durationSec: number; callSid: string } | null>(null);
  const [msg, setMsg] = useState("");

  const [bk, setBk] = useState({ name: "", email: "", phone: "", business: "", when: "", notes: "", tz: "America/New_York" });
  const [bkMsg, setBkMsg] = useState("");

  // add-leads panel
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState("");
  const [addMsg, setAddMsg] = useState("");

  // scoreboard
  const [callsToday, setCallsToday] = useState(0);
  const [target, setTarget] = useState(40);

  // per-lead call history + live-due nudge
  const [history, setHistory] = useState<{ id: string; created_at: string; outcome: string | null; duration_seconds: number; notes: string | null; twilio_call_sid: string | null }[]>([]);
  const [, setTick] = useState(0);
  const prevDueRef = useRef(0);

  const activeRef = useRef<Lead | null>(null);
  const lastManualRef = useRef("");

  const dialer = useDialer(({ durationSec, callSid }) => {
    const lead = activeRef.current;
    if (!lead) {
      fetch("/api/calls/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealership_phone: lastManualRef.current || "manual",
          twilio_call_sid: callSid,
          status: durationSec > 0 ? "completed" : "no-answer",
          duration_seconds: durationSec,
          outcome: "Manual call",
        }),
      }).catch(() => {});
      setCallsToday((n) => n + 1);
      return;
    }
    setLastCall({ durationSec, callSid });
  });
  const { status } = dialer;

  const supabase = createClient();
  async function loadLeads() {
    try {
      const res = await fetch("/api/leads");
      const body = await res.json();
      if (body.ok) setLeads(body.leads as Lead[]);
    } catch {
      /* ignore */
    }
  }
  async function loadStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const [{ count }, { data: prof }] = await Promise.all([
        supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
        supabase.from("profiles").select("daily_call_target").eq("id", user.id).maybeSingle(),
      ]);
      setCallsToday(count ?? 0);
      if (prof?.daily_call_target) setTarget(prof.daily_call_target);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadLeads();
    loadStats();
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    const t = setInterval(() => setTick((n) => n + 1), 30000); // refresh "due" state
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function padPress(key: string) {
    if (status === "live") dialer.sendDigits(key);
    else if (status === "idle") setDialInput((p) => (p + key).slice(0, 18));
  }
  function selectLead(l: Lead) {
    setActiveId(l.id); activeRef.current = l;
    setLastCall(null); setDispo(DISPOSITIONS[0].label); setDispoNotes("");
    setCallbackWhen("");
    setBk({ name: l.name ?? "", email: l.email ?? "", phone: l.phone, business: l.business ?? "", when: "", notes: "", tz: "America/New_York" });
    setMsg(""); setBkMsg("");
    fetchHistory(l.id);
  }
  async function fetchHistory(id: string) {
    setHistory([]);
    try {
      const r = await fetch(`/api/leads/${id}/calls`);
      const b = await r.json();
      if (b.ok) setHistory(b.calls);
    } catch { /* ignore */ }
  }
  function callLead(l: Lead) {
    if (status !== "idle") return;
    selectLead(l); dialer.call(l.phone);
  }
  function manualCall() {
    if (status !== "idle") return;
    const number = normalize(dialInput);
    if (!number) return dialer.setError("Enter a valid number, e.g. 201-555-1234");
    setActiveId(null); activeRef.current = null; lastManualRef.current = number;
    dialer.call(number);
  }

  async function saveDisposition() {
    const lead = activeRef.current;
    if (!lead) return;
    const d = DISPOSITIONS.find((x) => x.label === dispo)!;
    if (d.callback && !callbackWhen) return setMsg("Pick a callback date & time.");
    setMsg("Saving…");
    const stamped = `[${new Date().toLocaleString()}] ${d.label}${dispoNotes ? ": " + dispoNotes : ""}`;
    const notes = [lead.notes, stamped].filter(Boolean).join("\n");
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: d.status, attempts: (lead.attempts ?? 0) + 1,
        last_contacted_at: new Date().toISOString(),
        callback_at: d.callback ? new Date(callbackWhen).toISOString() : null, notes,
      }),
    });
    await fetch("/api/calls/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealership_name: displayName(lead), dealership_phone: lead.phone,
        twilio_call_sid: lastCall?.callSid ?? "",
        status: (lastCall?.durationSec ?? 0) > 0 ? "completed" : "no-answer",
        duration_seconds: lastCall?.durationSec ?? 0, outcome: d.label, notes: dispoNotes, lead_id: lead.id,
      }),
    });
    setActiveId(null); activeRef.current = null; setLastCall(null); setMsg("");
    if (lastCall) setCallsToday((n) => n + 1);
    loadLeads();
  }

  async function bookAppointment() {
    const lead = activeRef.current;
    if (!lead) return setBkMsg("Select a lead first.");
    if (!bk.when) return setBkMsg("Pick a date & time.");
    setBkMsg("Booking…");
    const phone = normalize(bk.phone) || lead.phone;
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospect_name: bk.name || lead.name, prospect_business: bk.business || lead.business,
        prospect_phone: phone, prospect_email: bk.email || null,
        scheduled_at: new Date(bk.when).toISOString(), notes: bk.notes, lead_id: lead.id,
      }),
    });
    // Persist the captured email back onto the lead for future reference.
    if (bk.email) fetch(`/api/leads/${lead.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: bk.email }),
    }).catch(() => {});
    if (res.ok) {
      setBkMsg("Appointment booked ✓ — sent to the closer.");
      setActiveId(null); activeRef.current = null; setLastCall(null); loadLeads();
    } else {
      const b = await res.json().catch(() => ({}));
      setBkMsg(b.error || "Could not book.");
    }
  }

  // Book a real client meeting via Cal.com (server-side) — Cal emails the client
  // the invite + Meet link and it lands on the owner's one calendar.
  async function bookCal() {
    const lead = activeRef.current;
    if (!lead) return setBkMsg("Select a lead first.");
    if (!bk.email) return setBkMsg("Enter the client’s email — Cal sends their invite there.");
    if (!bk.when) return setBkMsg("Pick a date & time.");
    setBkMsg("Booking on the calendar…");
    const res = await fetch("/api/cal/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bk.name || lead.name, email: bk.email, phone: normalize(bk.phone) || lead.phone,
        business: bk.business || lead.business, notes: bk.notes,
        start: bk.when, timeZone: bk.tz, leadId: lead.id,
      }),
    });
    const b = await res.json().catch(() => ({}));
    if (res.ok && b.ok) {
      setBkMsg("Booked ✓ — invite sent to the client.");
      setActiveId(null); activeRef.current = null; setLastCall(null); loadLeads();
    } else {
      setBkMsg(b.error || "Could not book on the calendar.");
    }
  }

  async function importAddFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let text: string;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        text = rows.map((r) => (Array.isArray(r) ? r.join(",") : "")).join("\n");
      } else text = await file.text();
      setAddText((p) => (p ? p + "\n" : "") + text);
    } catch {
      setAddMsg("Could not read that file.");
    } finally {
      e.target.value = "";
    }
  }
  async function addLeads() {
    const parsed = parseRows(addText);
    if (!parsed.length) return setAddMsg("No valid phone numbers found.");
    setAddMsg(`Adding ${parsed.length}…`);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: parsed }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setAddMsg(`Added ${body.inserted} to your queue ✓`);
      setAddText(""); loadLeads();
    } else setAddMsg(body.error || "Add failed.");
  }

  const now = Date.now();
  const followups = leads.filter((l) => l.status === "callback").sort((a, b) => (a.callback_at ?? "").localeCompare(b.callback_at ?? ""));
  const fresh = leads.filter((l) => l.status === "new");
  const working = leads.filter((l) => l.status === "attempted" || l.status === "contacted");
  const dueCount = followups.filter((l) => l.callback_at && new Date(l.callback_at).getTime() <= now).length;
  const nextDue = followups.find((l) => l.callback_at && new Date(l.callback_at).getTime() <= now) ?? null;
  // Notify when new follow-ups become due (desktop notification if permitted).
  useEffect(() => {
    if (dueCount > prevDueRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Follow-up due", { body: `${dueCount} follow-up${dueCount > 1 ? "s" : ""} due now` });
    }
    prevDueRef.current = dueCount;
  }, [dueCount]);
  const bookedCount = leads.filter((l) => l.status === "appointment").length;
  const wonCount = leads.filter((l) => l.status === "won").length;

  const base = tab === "followup" ? followups : tab === "new" ? fresh : tab === "working" ? working : leads;
  const q = query.trim().toLowerCase();
  const shown = q ? base.filter((l) => `${l.business ?? ""} ${l.name ?? ""} ${l.phone}`.toLowerCase().includes(q)) : base;

  const active = leads.find((l) => l.id === activeId) ?? activeRef.current;
  const d = DISPOSITIONS.find((x) => x.label === dispo)!;
  const mm = String(Math.floor(dialer.seconds / 60)).padStart(2, "0");
  const ss = String(dialer.seconds % 60).padStart(2, "0");
  const pct = Math.min(100, Math.round((callsToday / Math.max(1, target)) * 100));

  const TABS: [Tab, string, number][] = [
    ["followup", "Follow-ups", followups.length],
    ["new", "New", fresh.length],
    ["working", "Working", working.length],
    ["all", "All", leads.length],
  ];

  return (
    <>
    <SideNav />
    <div className="cp with-nav" style={{ ["--wall" as string]: "url(/wallpapers/drive4.jpg)" } as React.CSSProperties}>
      <div className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-mark" src="/logo-mark.png" alt="Rocky Solutions LLC" />
          <div>
          <h1>Call Console</h1>
          <div className="sub">
            Your assigned leads. {dueCount > 0 && <strong className="conv">{dueCount} follow-up{dueCount > 1 ? "s" : ""} due now.</strong>} All calls are recorded.
          </div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" onClick={() => { loadLeads(); loadStats(); }}>Refresh</button>
          <BookCall label="📆 Schedule call" className="btn-ghost" />
          {!dialer.ready && <button className="btn-blue" onClick={() => dialer.connectDevice()}>Connect phone</button>}
          {dialer.ready && <span className="hint" style={{ alignSelf: "center" }}>Phone ready ✓</span>}
        </div>
      </div>

      <Quote />
      {dialer.error && <div className="banner">{dialer.error}</div>}

      {dueCount > 0 && (
        <div className="nudge">
          <span>🔔 <strong>{dueCount}</strong> follow-up{dueCount > 1 ? "s" : ""} due{nextDue && <> — next: <strong>{displayName(nextDue)}</strong></>}</span>
          {nextDue && status === "idle" && <button className="btn-green sm" onClick={() => callLead(nextDue)}>Call next</button>}
        </div>
      )}

      {/* Scoreboard */}
      <div className="stats">
        <div className="stat">
          <div className="stat-n">{callsToday}<span className="stat-u">/{target}</span></div>
          <div className="prog" style={{ margin: "8px 0 6px" }}><span className={pct >= 100 ? "bar full" : "bar"} style={{ width: `${pct}%` }} /></div>
          <div className="stat-l">📞 Calls today</div>
        </div>
        <div className="stat"><div className="stat-n">{dueCount}</div><div className="stat-l">🔥 Due now</div></div>
        <div className="stat"><div className="stat-n">{fresh.length}</div><div className="stat-l">🆕 New</div></div>
        <div className="stat"><div className="stat-n">{bookedCount}</div><div className="stat-l">📅 Booked</div></div>
        <div className="stat good"><div className="stat-n">{wonCount}</div><div className="stat-l">🏆 Won</div></div>
      </div>

      <div className="grid">
        {/* LEFT: lead queues */}
        <div className="panel">
          <div className="segmented" style={{ display: "flex", flexWrap: "wrap", marginBottom: 12 }}>
            {TABS.map(([t, label, n]) => (
              <button key={t} className={`seg ${t === tab ? "on" : ""}`} onClick={() => setTab(t)} style={{ border: "none", background: t === tab ? undefined : "transparent" }}>
                {label} {n > 0 && <span className="tab-n">{n}</span>}
              </button>
            ))}
          </div>
          <input className="search" placeholder="🔎 Search name or number…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="toolbar">
            <span className="hint" style={{ margin: 0 }}>🔴 Calls are recorded</span>
            <button className="btn-ghost sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Close" : "＋ Add leads"}</button>
          </div>

          {showAdd && (
            <div className="addbox">
              <textarea placeholder={"Business, Phone[, Contact]\nCool Air HVAC, 201-555-1234"} value={addText} onChange={(e) => setAddText(e.target.value)} />
              <div className="actions" style={{ alignItems: "center", margin: "8px 0 0" }}>
                <label className="btn-ghost sm" style={{ cursor: "pointer" }}>
                  Import CSV/Excel
                  <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={importAddFile} style={{ display: "none" }} />
                </label>
                <button className="btn-blue sm" onClick={addLeads}>Add to my queue</button>
                {addMsg && <span className="hint" style={{ margin: 0 }}>{addMsg}</span>}
              </div>
            </div>
          )}

          {!shown.length && <div className="empty">{q ? "🔍 No matches." : tab === "followup" ? "✅ No callbacks scheduled — nice." : "📭 Nothing here yet. Add leads or ask your admin."}</div>}
          {shown.map((l) => {
            const due = l.callback_at && new Date(l.callback_at).getTime() <= now;
            return (
              <div key={l.id} className={`lead ${l.id === activeId ? "active" : ""}`} onClick={() => selectLead(l)}>
                <div>
                  <div className="nm">{displayName(l)} <span className={`badge ${STATUS_META[l.status].cls}`}>{STATUS_META[l.status].label}</span></div>
                  <div className="ph">{l.phone}{l.attempts > 0 && ` · ${l.attempts} attempt${l.attempts > 1 ? "s" : ""}`}</div>
                  {l.status === "callback" && l.callback_at && <div className={`ph ${due ? "conv" : ""}`}>⏰ {fmt(l.callback_at)}{due ? " · due" : ""}</div>}
                </div>
                <button className="btn-green" disabled={status !== "idle"} onClick={(e) => { e.stopPropagation(); callLead(l); }}>Call</button>
              </div>
            );
          })}
        </div>

        {/* RIGHT */}
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <h2>Active call</h2>
            <div className="dialer">
              {status === "idle" && !active && <div className="status">Pick a lead on the left, or dial manually below.</div>}
              {active && status === "idle" && !lastCall && <div className="status">{displayName(active)} — press Call, or log without calling.</div>}
              {status === "connecting" && (
                <>
                  <div className="callee">{active ? displayName(active) : dialInput}</div>
                  <div className="status">Connecting…</div>
                  <div className="controls"><button className="btn-red" onClick={dialer.hangup}>Cancel</button></div>
                </>
              )}
              {status === "live" && (
                <>
                  <div className="callee">{active ? displayName(active) : dialInput}</div>
                  <div className="status live">● On call</div>
                  <div className="timer">{mm}:{ss}</div>
                  <div className="controls">
                    <button className="btn-ghost" onClick={dialer.toggleMute}>{dialer.muted ? "Unmute" : "Mute"}</button>
                    <button className="btn-blue" onClick={() => document.getElementById("book-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })}>📅 Book</button>
                    <button className="btn-red" onClick={dialer.hangup}>Hang up</button>
                  </div>
                </>
              )}
              {status === "idle" && (
                <>
                  <input className="dial-display" value={dialInput} onChange={(e) => setDialInput(e.target.value)} placeholder="Manual dial" />
                  <div className="dialpad">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (<button key={k} className="pad-key" onClick={() => padPress(k)}>{k}</button>))}
                  </div>
                  <div className="controls" style={{ marginTop: 12 }}>
                    <button className="btn-ghost" onClick={() => setDialInput((p) => p.slice(0, -1))} disabled={!dialInput}>⌫</button>
                    <button className="btn-green" onClick={manualCall} disabled={!dialInput}>Dial</button>
                  </div>
                </>
              )}
              {status === "live" && <div className="dialpad" style={{ marginTop: 12 }}>{["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (<button key={k} className="pad-key" onClick={() => padPress(k)}>{k}</button>))}</div>}
              {status !== "idle" && (
                <input value={dispoNotes} onChange={(e) => setDispoNotes(e.target.value)} placeholder="📝 Notes while on the call…" style={{ marginTop: 12 }} />
              )}
            </div>
          </div>

          {active && status === "idle" && (
            <div className="panel">
              <h2>Log call · {displayName(active)}</h2>
              {active.notes && <div className="appt-notes" style={{ whiteSpace: "pre-wrap", marginBottom: 10 }}>{active.notes}</div>}
              <div className="row2">
                <div>
                  <label>Disposition</label>
                  <select value={dispo} onChange={(e) => setDispo(e.target.value)}>{DISPOSITIONS.map((o) => <option key={o.label}>{o.label}</option>)}</select>
                </div>
                {d.callback && <div><label>Callback at</label><input type="datetime-local" value={callbackWhen} onChange={(e) => setCallbackWhen(e.target.value)} /></div>}
              </div>
              <label>Notes</label>
              <input value={dispoNotes} onChange={(e) => setDispoNotes(e.target.value)} placeholder="What happened on the call…" />
              <div className="actions" style={{ alignItems: "center" }}>
                <button className="btn-blue" onClick={saveDisposition}>Save call</button>
                {msg && <span className="hint" style={{ margin: 0 }}>{msg}</span>}
              </div>
            </div>
          )}

          {(active || status === "idle") && (
            <div className="panel" id="book-panel">
              <h2>📅 Book appointment{active ? ` · ${displayName(active)}` : ""}{status !== "idle" && <span className="hint" style={{ marginLeft: 8 }}>— you’re on the call</span>}</h2>
              {!active ? (
                <div className="muted">Select a lead on the left to capture their details and schedule.</div>
              ) : (
                <>
                  <div className="row2">
                    <div><label>Client name</label><input value={bk.name} onChange={(e) => setBk({ ...bk, name: e.target.value })} placeholder="Who you spoke with" /></div>
                    <div><label>Client email (for their confirmation)</label><input type="email" value={bk.email} onChange={(e) => setBk({ ...bk, email: e.target.value })} placeholder="client@company.com" /></div>
                  </div>
                  <div className="row2">
                    <div><label>Phone</label><input value={bk.phone} onChange={(e) => setBk({ ...bk, phone: e.target.value })} /></div>
                    <div><label>Business</label><input value={bk.business} onChange={(e) => setBk({ ...bk, business: e.target.value })} /></div>
                  </div>
                  <div className="row2">
                    <div>
                      <label>Client timezone</label>
                      <select value={bk.tz} onChange={(e) => setBk({ ...bk, tz: e.target.value })}>
                        {US_TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div><label>Date &amp; time (client’s time)</label><input type="datetime-local" value={bk.when} onChange={(e) => setBk({ ...bk, when: e.target.value })} /></div>
                  </div>
                  <label>Notes / what they need</label>
                  <input value={bk.notes} onChange={(e) => setBk({ ...bk, notes: e.target.value })} placeholder="Context for the closer…" />
                  <div className="actions" style={{ alignItems: "center" }}>
                    <button className="btn-green" onClick={bookCal}>📆 Book &amp; send client invite</button>
                    <button className="btn-ghost" onClick={bookAppointment}>Book without invite</button>
                    {bkMsg && <span className="hint" style={{ margin: 0 }}>{bkMsg}</span>}
                  </div>
                  <div className="hint">Bookable while on the call. “Book &amp; send client invite” emails the client via Cal (enter their email above) and shows on the closer/admin views; “without invite” just logs it in-app.</div>
                </>
              )}
            </div>
          )}

          {active && status === "idle" && (
            <div className="panel">
              <h2>Call history · {displayName(active)}</h2>
              {!history.length && <div className="muted">No prior calls logged for this lead.</div>}
              {history.map((h) => (
                <div key={h.id} className="hist">
                  <div>
                    <div className="nm">{h.outcome || "—"} <span className="ph">· {h.duration_seconds}s</span></div>
                    <div className="ph">{new Date(h.created_at).toLocaleString()}</div>
                    {h.notes && <div className="appt-notes">{h.notes}</div>}
                  </div>
                  {h.twilio_call_sid && <a href={`/api/voice/recording-media?callSid=${h.twilio_call_sid}`} target="_blank" rel="noreferrer">▶ Play</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
