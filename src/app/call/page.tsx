"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import "./call.css";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xqerkekp";

const OUTCOMES = [
  "Interested",
  "Call back later",
  "Not interested",
  "No answer",
  "Voicemail",
  "Wrong / bad number",
  "Do not call",
];

interface Lead {
  id: string;
  name: string;
  number: string;
  done: boolean;
}

interface LogEntry {
  name: string;
  number: string;
  at: string;
  durationSec: number;
  outcome: string;
  notes: string;
  callSid: string;
}

function normalize(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`; // US local
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`; // US with 1
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`; // international w/ country code
  return null;
}

function parseLeads(text: string): Lead[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      // "Name, number" or "number" or "number, Name"
      let name = "";
      let number: string | null = null;
      for (const p of parts) {
        const n = normalize(p);
        if (n && !number) number = n;
        else if (p) name = name ? `${name} ${p}` : p;
      }
      return number ? { id: `${i}-${number}`, name: name || number, number, done: false } : null;
    })
    .filter((l): l is Lead => l !== null);
}

export default function CallPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [leadText, setLeadText] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live">("idle");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [notes, setNotes] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [dialInput, setDialInput] = useState("");

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      deviceRef.current?.destroy();
    };
  }, []);

  async function connectDevice(): Promise<Device | null> {
    if (deviceRef.current) return deviceRef.current;
    setError("");
    try {
      const res = await fetch("/api/voice/token");
      if (!res.ok) throw new Error("Could not get a calling token. Is the backend configured?");
      const { token } = await res.json();
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(token, { codecPreferences: ["opus", "pcmu"] as never });
      device.on("error", (e: { message: string }) => setError(e.message));
      await device.register();
      deviceRef.current = device;
      setReady(true);
      return device;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect device.");
      return null;
    }
  }

  function startTimer() {
    startedAtRef.current = Date.now();
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // Dialpad: during a live call, keys send DTMF tones (phone menus);
  // otherwise they build up a number to dial manually.
  function padPress(key: string) {
    if (status === "live") {
      callRef.current?.sendDigits(key);
    } else if (status === "idle") {
      setDialInput((prev) => (prev + key).slice(0, 18));
    }
  }

  function manualCall() {
    const number = normalize(dialInput);
    if (!number) {
      setError("Enter a valid number to dial, e.g. 201-555-1234");
      return;
    }
    callLead({ id: `manual-${Date.now()}`, name: number, number, done: false });
  }

  async function callLead(lead: Lead) {
    if (status !== "idle") return;
    setError("");
    setActiveId(lead.id);
    setOutcome(OUTCOMES[0]);
    setNotes("");
    setMuted(false);
    setStatus("connecting");
    const device = await connectDevice();
    if (!device) {
      setStatus("idle");
      setActiveId(null);
      return;
    }
    try {
      const call = await device.connect({ params: { To: lead.number } });
      callRef.current = call;
      call.on("accept", () => {
        setStatus("live");
        startTimer();
      });
      call.on("disconnect", () => finalizeCall(lead));
      call.on("cancel", () => finalizeCall(lead));
      call.on("error", (e: { message: string }) => {
        setError(e.message);
        finalizeCall(lead);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call failed.");
      setStatus("idle");
      setActiveId(null);
    }
  }

  function finalizeCall(lead: Lead) {
    stopTimer();
    const dur = status === "live" ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;
    const callSid = (callRef.current?.parameters?.CallSid as string) || "";
    setLog((prev) => [
      {
        name: lead.name,
        number: lead.number,
        at: new Date().toLocaleString(),
        durationSec: dur,
        outcome,
        notes,
        callSid,
      },
      ...prev,
    ]);
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, done: true } : l)));
    callRef.current = null;
    setStatus("idle");
    setActiveId(null);
    setSeconds(0);
  }

  function hangup() {
    callRef.current?.disconnect();
  }
  function toggleMute() {
    const c = callRef.current;
    if (!c) return;
    const next = !muted;
    c.mute(next);
    setMuted(next);
  }

  function mergeLeads(incoming: Lead[]) {
    setLeads((prev) => {
      const seen = new Set(prev.map((l) => l.number));
      const merged = [...prev];
      for (const l of incoming) {
        if (!seen.has(l.number)) {
          merged.push(l);
          seen.add(l.number);
        }
      }
      return merged;
    });
  }

  function loadLeads() {
    mergeLeads(parseLeads(leadText));
  }

  // Import leads from a CSV or Excel (.xlsx/.xls) file. Any column that looks
  // like a phone number is used as the number; other cells become the name.
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      let text: string;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        text = rows.map((r) => (Array.isArray(r) ? r.join(",") : "")).join("\n");
      } else {
        text = await file.text();
      }
      const parsed = parseLeads(text);
      if (!parsed.length) {
        setError("No valid phone numbers found in that file. Include a column with phone numbers.");
        return;
      }
      mergeLeads(parsed);
    } catch {
      setError("Could not read that file. Use a CSV or Excel file with name and phone columns.");
    } finally {
      e.target.value = "";
    }
  }

  function csv(): string {
    const head = "Business,Number,Time,Duration(s),Outcome,Notes,CallSid";
    const rows = log.map((e) =>
      [e.name, e.number, e.at, e.durationSec, e.outcome, e.notes.replace(/"/g, "'"), e.callSid]
        .map((c) => `"${String(c)}"`)
        .join(",")
    );
    return [head, ...rows].join("\n");
  }
  function exportCsv() {
    const blob = new Blob([csv()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rocky-call-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
  async function emailReport() {
    const summary = log
      .map((e) => `${e.name} (${e.number}) — ${e.outcome}, ${e.durationSec}s\n  ${e.notes}`)
      .join("\n\n");
    await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `Cold-call report — ${log.length} calls — ${new Date().toLocaleDateString()}`,
        message: summary || "No calls logged.",
      }),
    });
    alert("Report emailed.");
  }

  const activeLead = leads.find((l) => l.id === activeId);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="cp">
      <h1>Rocky Solutions — Call Console</h1>
      <div className="sub">Cold-call NJ HVAC businesses from +1 201-347-7569. Calls are recorded; the callee hears a recording notice.</div>

      {error && <div className="banner">{error}</div>}

      <div className="grid">
        {/* LEFT: leads */}
        <div className="panel">
          <h2>Leads</h2>
          <textarea
            placeholder={"One per line:\nCool Air HVAC, 201-555-1234\nHudson Heating, +12015559876"}
            value={leadText}
            onChange={(e) => setLeadText(e.target.value)}
          />
          <div className="actions">
            <button className="btn-ghost" onClick={loadLeads}>Load pasted</button>
            <label className="btn-ghost" style={{ cursor: "pointer" }}>
              Import CSV / Excel
              <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={importFile} style={{ display: "none" }} />
            </label>
            {!ready && <button className="btn-blue" onClick={() => connectDevice()}>Connect phone</button>}
            {ready && <span className="hint" style={{ alignSelf: "center" }}>Phone ready ✓</span>}
          </div>
          {leads.map((l) => (
            <div key={l.id} className={`lead ${l.id === activeId ? "active" : ""} ${l.done ? "done" : ""}`}>
              <div>
                <div className="nm">{l.name}</div>
                <div className="ph">{l.number}</div>
              </div>
              <button
                className="btn-green"
                disabled={status !== "idle"}
                onClick={() => callLead(l)}
              >
                Call
              </button>
            </div>
          ))}
        </div>

        {/* RIGHT: dialer + notes + log */}
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <h2>Active call</h2>
            <div className="dialer">
              {status === "idle" && <div className="status">Idle — pick a lead and press Call.</div>}
              {status === "connecting" && (
                <>
                  <div className="callee">{activeLead?.name}</div>
                  <div className="status">Connecting… (allow microphone if prompted)</div>
                </>
              )}
              {status === "live" && (
                <>
                  <div className="callee">{activeLead?.name}</div>
                  <div className="status live">● On call</div>
                  <div className="timer">{mm}:{ss}</div>
                  <div className="controls">
                    <button className="btn-ghost" onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
                    <button className="btn-red" onClick={hangup}>Hang up</button>
                  </div>
                </>
              )}

              {/* Dialpad: manual dial when idle, DTMF keypad when live */}
              {status === "idle" && (
                <>
                  <input
                    className="dial-display"
                    value={dialInput}
                    onChange={(e) => setDialInput(e.target.value)}
                    placeholder="Type or tap a number"
                  />
                  <div className="hint" style={{ textAlign: "center", marginTop: -6, marginBottom: 6 }}>
                    US: 10 digits. International: include country code (e.g. 91 for India → 919XXXXXXXXX).
                  </div>
                </>
              )}
              {(status === "idle" || status === "live") && (
                <>
                  <div className="dialpad">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                      <button key={k} className="pad-key" onClick={() => padPress(k)}>{k}</button>
                    ))}
                  </div>
                  {status === "idle" && (
                    <div className="controls" style={{ marginTop: 12 }}>
                      <button className="btn-ghost" onClick={() => setDialInput((p) => p.slice(0, -1))} disabled={!dialInput}>⌫</button>
                      <button className="btn-green" onClick={manualCall} disabled={!dialInput || status !== "idle"}>Call this number</button>
                    </div>
                  )}
                  {status === "live" && <div className="hint">Tap keys to send tones (e.g. phone menus)</div>}
                </>
              )}
            </div>
            {(status === "live" || status === "connecting") && (
              <div className="row2">
                <div>
                  <label>Outcome</label>
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                    {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label>Notes</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened…" />
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Call report ({log.length})</h2>
            <div className="actions">
              <button className="btn-ghost" onClick={exportCsv} disabled={!log.length}>Export CSV</button>
              <button className="btn-blue" onClick={emailReport} disabled={!log.length}>Email report</button>
            </div>
            <table>
              <thead>
                <tr><th>Business</th><th>Time</th><th>Dur</th><th>Outcome</th><th>Notes</th><th>Recording</th></tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i}>
                    <td>{e.name}<br /><span className="ph">{e.number}</span></td>
                    <td>{e.at}</td>
                    <td>{e.durationSec}s</td>
                    <td>{e.outcome}</td>
                    <td>{e.notes}</td>
                    <td>{e.callSid ? <a href={`/api/voice/recording-media?callSid=${e.callSid}`} target="_blank" rel="noreferrer">▶ Play</a> : "—"}</td>
                  </tr>
                ))}
                {!log.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No calls yet.</td></tr>}
              </tbody>
            </table>
            <div className="hint">Recordings take a few seconds to process after hang-up before playback works.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
