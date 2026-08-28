"use client";

import { useEffect, useRef, useState } from "react";
import { useDialer } from "@/lib/useDialer";
import type { LeadStatus } from "@/lib/database.types";
import Quote from "../Quote";
import "./call.css";

interface Lead {
  id: string;
  name: string | null;
  business: string | null;
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

// Call dispositions → the pipeline stage they move the lead to.
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

function normalize(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}
const displayName = (l: Lead) => l.business || l.name || l.phone;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function CallPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<Tab>("followup");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [record, setRecord] = useState(true);
  const [dialInput, setDialInput] = useState("");

  // disposition (shown after a call to the active lead)
  const [dispo, setDispo] = useState(DISPOSITIONS[0].label);
  const [dispoNotes, setDispoNotes] = useState("");
  const [callbackWhen, setCallbackWhen] = useState("");
  const [lastCall, setLastCall] = useState<{ durationSec: number; callSid: string } | null>(null);
  const [msg, setMsg] = useState("");

  // booking
  const [bk, setBk] = useState({ when: "", notes: "" });
  const [bkMsg, setBkMsg] = useState("");

  const activeRef = useRef<Lead | null>(null);

  const dialer = useDialer(({ durationSec, callSid }) => {
    const lead = activeRef.current;
    if (!lead) {
      // ad-hoc manual call — log it without a lead
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
      return;
    }
    setLastCall({ durationSec, callSid });
  });
  const { status } = dialer;
  const lastManualRef = useRef("");

  async function loadLeads() {
    try {
      const res = await fetch("/api/leads");
      const body = await res.json();
      if (body.ok) setLeads(body.leads as Lead[]);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadLeads();
  }, []);

  function selectLead(l: Lead) {
    setActiveId(l.id);
    activeRef.current = l;
    setLastCall(null);
    setDispo(DISPOSITIONS[0].label);
    setDispoNotes("");
    setCallbackWhen("");
    setBk({ when: "", notes: "" });
    setMsg("");
    setBkMsg("");
  }

  function callLead(l: Lead) {
    if (status !== "idle") return;
    selectLead(l);
    dialer.call(l.phone, record);
  }

  function manualCall() {
    if (status !== "idle") return;
    const number = normalize(dialInput);
    if (!number) return dialer.setError("Enter a valid number, e.g. 201-555-1234");
    setActiveId(null);
    activeRef.current = null;
    lastManualRef.current = number;
    dialer.call(number, record);
  }

  function padPress(key: string) {
    if (status === "live") dialer.sendDigits(key);
    else if (status === "idle") setDialInput((p) => (p + key).slice(0, 18));
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
        status: d.status,
        attempts: (lead.attempts ?? 0) + 1,
        last_contacted_at: new Date().toISOString(),
        callback_at: d.callback ? new Date(callbackWhen).toISOString() : null,
        notes,
      }),
    });
    await fetch("/api/calls/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealership_name: displayName(lead),
        dealership_phone: lead.phone,
        twilio_call_sid: lastCall?.callSid ?? "",
        status: (lastCall?.durationSec ?? 0) > 0 ? "completed" : "no-answer",
        duration_seconds: lastCall?.durationSec ?? 0,
        outcome: d.label,
        notes: dispoNotes,
        lead_id: lead.id,
      }),
    });

    setActiveId(null);
    activeRef.current = null;
    setLastCall(null);
    setMsg("");
    loadLeads();
  }

  async function bookAppointment() {
    const lead = activeRef.current;
    if (!lead) return setBkMsg("Select a lead first.");
    if (!bk.when) return setBkMsg("Pick a date & time.");
    setBkMsg("Booking…");
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospect_name: lead.name,
        prospect_business: lead.business,
        prospect_phone: lead.phone,
        scheduled_at: new Date(bk.when).toISOString(),
        notes: bk.notes,
        lead_id: lead.id,
      }),
    });
    if (res.ok) {
      setBkMsg("Appointment booked ✓ — sent to the closer.");
      setBk({ when: "", notes: "" });
      setActiveId(null);
      activeRef.current = null;
      setLastCall(null);
      loadLeads();
    } else {
      const b = await res.json().catch(() => ({}));
      setBkMsg(b.error || "Could not book.");
    }
  }

  const now = Date.now();
  const followups = leads
    .filter((l) => l.status === "callback")
    .sort((a, b) => (a.callback_at ?? "").localeCompare(b.callback_at ?? ""));
  const fresh = leads.filter((l) => l.status === "new");
  const working = leads.filter((l) => l.status === "attempted" || l.status === "contacted");
  const dueCount = followups.filter((l) => l.callback_at && new Date(l.callback_at).getTime() <= now).length;

  const shown = tab === "followup" ? followups : tab === "new" ? fresh : tab === "working" ? working : leads;
  const active = leads.find((l) => l.id === activeId) ?? activeRef.current;
  const d = DISPOSITIONS.find((x) => x.label === dispo)!;
  const mm = String(Math.floor(dialer.seconds / 60)).padStart(2, "0");
  const ss = String(dialer.seconds % 60).padStart(2, "0");

  const TABS: [Tab, string, number][] = [
    ["followup", "Follow-ups", followups.length],
    ["new", "New", fresh.length],
    ["working", "Working", working.length],
    ["all", "All", leads.length],
  ];

  return (
    <div className="cp" style={{ ["--wall" as string]: "url(/wallpapers/drive4.jpg)" } as React.CSSProperties}>
      <div className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-mark" src="/logo-mark.png" alt="Rocky Solutions LLC" />
          <div>
          <h1>Call Console</h1>
          <div className="sub">
            Your assigned leads. {dueCount > 0 && <strong className="conv">{dueCount} follow-up{dueCount > 1 ? "s" : ""} due now.</strong>} Recording is {record ? "ON" : "OFF"}.
          </div>
        </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" onClick={loadLeads}>Refresh</button>
          {!dialer.ready && <button className="btn-blue" onClick={() => dialer.connectDevice()}>Connect phone</button>}
          {dialer.ready && <span className="hint" style={{ alignSelf: "center" }}>Phone ready ✓</span>}
          <form action="/api/auth/signout" method="post"><button className="btn-ghost" type="submit">Sign out</button></form>
        </div>
      </div>

      <Quote />
      {dialer.error && <div className="banner">{dialer.error}</div>}

      <div className="grid">
        {/* LEFT: lead queues */}
        <div className="panel">
          <div className="segmented" style={{ display: "flex", marginBottom: 12 }}>
            {TABS.map(([t, label, n]) => (
              <button key={t} className={`seg ${t === tab ? "on" : ""}`} onClick={() => setTab(t)} style={{ border: "none", background: t === tab ? undefined : "transparent" }}>
                {label} {n > 0 && <span className="tab-n">{n}</span>}
              </button>
            ))}
          </div>
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input type="checkbox" checked={record} disabled={status !== "idle"} onChange={(e) => setRecord(e.target.checked)} />
            Record calls (on by default)
          </label>

          {!shown.length && <div className="muted" style={{ padding: "8px 0" }}>Nothing here. {tab === "followup" ? "No callbacks scheduled." : "Ask your admin to assign leads."}</div>}
          {shown.map((l) => {
            const due = l.callback_at && new Date(l.callback_at).getTime() <= now;
            return (
              <div key={l.id} className={`lead ${l.id === activeId ? "active" : ""}`} onClick={() => selectLead(l)}>
                <div>
                  <div className="nm">{displayName(l)} <span className={`badge ${STATUS_META[l.status].cls}`}>{STATUS_META[l.status].label}</span></div>
                  <div className="ph">{l.phone}{l.attempts > 0 && ` · ${l.attempts} attempt${l.attempts > 1 ? "s" : ""}`}</div>
                  {l.status === "callback" && l.callback_at && (
                    <div className={`ph ${due ? "conv" : ""}`}>⏰ {fmt(l.callback_at)}{due ? " · due" : ""}</div>
                  )}
                </div>
                <button className="btn-green" disabled={status !== "idle"} onClick={(e) => { e.stopPropagation(); callLead(l); }}>Call</button>
              </div>
            );
          })}
        </div>

        {/* RIGHT: active call / disposition / booking / manual */}
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <h2>Active call</h2>
            <div className="dialer">
              {status === "idle" && !active && <div className="status">Pick a lead on the left, or dial manually below.</div>}
              {active && status === "idle" && !lastCall && (
                <div className="status">{displayName(active)} — press Call, or log without calling.</div>
              )}
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
                    <button className="btn-red" onClick={dialer.hangup}>Hang up</button>
                  </div>
                </>
              )}

              {status === "idle" && (
                <>
                  <input className="dial-display" value={dialInput} onChange={(e) => setDialInput(e.target.value)} placeholder="Manual dial" />
                  <div className="dialpad">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                      <button key={k} className="pad-key" onClick={() => padPress(k)}>{k}</button>
                    ))}
                  </div>
                  <div className="controls" style={{ marginTop: 12 }}>
                    <button className="btn-ghost" onClick={() => setDialInput((p) => p.slice(0, -1))} disabled={!dialInput}>⌫</button>
                    <button className="btn-green" onClick={manualCall} disabled={!dialInput}>Dial</button>
                  </div>
                </>
              )}
              {status === "live" && <div className="dialpad" style={{ marginTop: 12 }}>{["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (<button key={k} className="pad-key" onClick={() => padPress(k)}>{k}</button>))}</div>}
            </div>
          </div>

          {/* Disposition — log the outcome of a call to the active lead */}
          {active && status === "idle" && (
            <div className="panel">
              <h2>Log call · {displayName(active)}</h2>
              {active.notes && <div className="appt-notes" style={{ whiteSpace: "pre-wrap", marginBottom: 10 }}>{active.notes}</div>}
              <div className="row2">
                <div>
                  <label>Disposition</label>
                  <select value={dispo} onChange={(e) => setDispo(e.target.value)}>
                    {DISPOSITIONS.map((o) => <option key={o.label}>{o.label}</option>)}
                  </select>
                </div>
                {d.callback && (
                  <div>
                    <label>Callback at</label>
                    <input type="datetime-local" value={callbackWhen} onChange={(e) => setCallbackWhen(e.target.value)} />
                  </div>
                )}
              </div>
              <label>Notes</label>
              <input value={dispoNotes} onChange={(e) => setDispoNotes(e.target.value)} placeholder="What happened on the call…" />
              <div className="actions" style={{ alignItems: "center" }}>
                <button className="btn-blue" onClick={saveDisposition}>Save call</button>
                {msg && <span className="hint" style={{ margin: 0 }}>{msg}</span>}
              </div>
            </div>
          )}

          {/* Book appointment for the active lead → hands off to the closer */}
          {active && status === "idle" && (
            <div className="panel">
              <h2>Book appointment · {displayName(active)}</h2>
              <div className="row2">
                <div>
                  <label>Date &amp; time</label>
                  <input type="datetime-local" value={bk.when} onChange={(e) => setBk({ ...bk, when: e.target.value })} />
                </div>
                <div>
                  <label>Notes for the closer</label>
                  <input value={bk.notes} onChange={(e) => setBk({ ...bk, notes: e.target.value })} placeholder="Context…" />
                </div>
              </div>
              <div className="actions" style={{ alignItems: "center" }}>
                <button className="btn-green" onClick={bookAppointment}>Book &amp; hand to closer</button>
                {bkMsg && <span className="hint" style={{ margin: 0 }}>{bkMsg}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
