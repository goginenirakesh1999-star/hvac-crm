"use client";

import { useState } from "react";

interface Member {
  id: string;
  name: string;
  role: string;
}

// Lets a manager hand a locked-out team member a temporary password.
// Everyone who can still sign in changes their own at /account instead.
export default function TeamAccess({ members }: { members: Member[] }) {
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function reset(m: Member) {
    setErr("");
    setBusy(m.id);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: m.id }),
    });
    const body = await res.json();
    setBusy("");
    if (!res.ok) {
      setErr(body.error ?? "Could not set a new password.");
      return;
    }
    setIssued((prev) => ({ ...prev, [m.id]: body.password }));
  }

  return (
    <div className="panel">
      <h2>Team access ({members.length})</h2>
      <div className="sub" style={{ marginBottom: 10 }}>
        Anyone who can sign in should set their own password at <strong>/account</strong>. Use this
        only when someone is locked out — it replaces their password immediately.
      </div>
      <table className="tbl">
        <thead>
          <tr><th>Member</th><th>Role</th><th>Temporary password</th><th></th></tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.role}</td>
              <td>
                {issued[m.id]
                  ? <code>{issued[m.id]}</code>
                  : <span className="muted">—</span>}
              </td>
              <td>
                <button
                  className="btn-ghost"
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => reset(m)}
                >
                  {busy === m.id ? "Setting…" : issued[m.id] ? "Set another" : "Set temporary password"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <div className="banner" style={{ marginTop: 12 }}>{err}</div>}
      <div className="hint">
        Shown once, here. Pass it to them directly and have them change it at /account.
      </div>
    </div>
  );
}
