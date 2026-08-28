"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { LeadStatus } from "@/lib/database.types";

interface Lead {
  id: string;
  assigned_to: string | null;
  name: string | null;
  business: string | null;
  phone: string;
  status: LeadStatus;
  attempts: number;
  last_contacted_at: string | null;
  callback_at: string | null;
  owner: string;
}
interface Caller {
  id: string;
  name: string;
}

const STAGES: { key: LeadStatus; label: string; cls: string }[] = [
  { key: "new", label: "New", cls: "b-new" },
  { key: "attempted", label: "Attempted", cls: "b-att" },
  { key: "contacted", label: "Contacted", cls: "b-con" },
  { key: "callback", label: "Callback", cls: "b-cb" },
  { key: "appointment", label: "Appointment", cls: "b-appt" },
  { key: "won", label: "Won", cls: "b-won" },
  { key: "lost", label: "Lost", cls: "b-lost" },
  { key: "dnc", label: "DNC", cls: "b-lost" },
];

function normalize(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

// Parse "Business, Phone[, Name]" style rows into leads.
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

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

export default function LeadManager({ callers }: { callers: Caller[] }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [paste, setPaste] = useState("");
  const [assignTo, setAssignTo] = useState("split");
  const [msg, setMsg] = useState("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fCaller, setFCaller] = useState<string>("");

  async function load() {
    try {
      const res = await fetch("/api/leads");
      const body = await res.json();
      if (body.ok) setLeads(body.leads as Lead[]);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setPaste((p) => (p ? p + "\n" : "") + text);
    } catch {
      setMsg("Could not read that file.");
    } finally {
      e.target.value = "";
    }
  }

  async function upload() {
    const parsed = parseRows(paste);
    if (!parsed.length) return setMsg("No valid phone numbers found.");
    setMsg(`Uploading ${parsed.length}…`);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: parsed, assignTo }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(`Added ${body.inserted} leads ✓`);
      setPaste("");
      load();
    } else {
      setMsg(body.error || "Upload failed.");
    }
  }

  const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0])) as Record<LeadStatus, number>;
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;

  const filtered = leads.filter(
    (l) => (!fStatus || l.status === fStatus) && (!fCaller || l.assigned_to === fCaller)
  );

  return (
    <>
      {/* Pipeline board */}
      <div className="panel">
        <h2>Lead pipeline ({leads.length})</h2>
        <div className="pipeline">
          {STAGES.map((s) => (
            <div key={s.key} className="pipe-col" onClick={() => setFStatus(fStatus === s.key ? "" : s.key)}>
              <div className={`pipe-n ${s.cls}`}>{counts[s.key] ?? 0}</div>
              <div className="pipe-l">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload + assign */}
      <div className="panel">
        <h2>Upload &amp; assign leads</h2>
        <textarea
          placeholder={"One per line: Business, Phone[, Contact name]\nCool Air HVAC, 201-555-1234, John\nHudson Heating, +12015559876"}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="actions" style={{ alignItems: "center" }}>
          <label className="btn-ghost" style={{ cursor: "pointer" }}>
            Import CSV / Excel
            <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={importFile} style={{ display: "none" }} />
          </label>
          <label style={{ margin: 0 }}>Assign to</label>
          <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} style={{ width: "auto" }}>
            <option value="split">Split evenly among callers</option>
            {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-blue" onClick={upload}>Upload</button>
          {msg && <span className="hint" style={{ margin: 0 }}>{msg}</span>}
        </div>
      </div>

      {/* Lead tracker */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ marginBottom: 0 }}>Lead tracker ({filtered.length})</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ width: "auto" }}>
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={fCaller} onChange={(e) => setFCaller(e.target.value)} style={{ width: "auto" }}>
              <option value="">All callers</option>
              {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Lead</th><th>Phone</th><th>Owner</th><th>Stage</th><th>Att.</th><th>Last contact</th><th>Callback</th></tr>
            </thead>
            <tbody>
              {filtered.slice(0, 400).map((l) => {
                const meta = STAGES.find((s) => s.key === l.status)!;
                return (
                  <tr key={l.id}>
                    <td>{l.business || l.name || "—"}{l.name && l.business && <><br /><span className="ph">{l.name}</span></>}</td>
                    <td>{l.phone}</td>
                    <td>{l.owner || "—"}</td>
                    <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                    <td>{l.attempts}</td>
                    <td className="nowrap">{fmt(l.last_contacted_at)}</td>
                    <td className="nowrap">{fmt(l.callback_at)}</td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={7} className="muted">No leads yet — upload some above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
