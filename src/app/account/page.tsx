"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import SideNav from "../SideNav";
import "../call/call.css";

// Self-serve password change. Sign-in emails on this app are synthetic
// (see src/lib/auth.ts) so nothing can be sent to them — a signed-in user
// setting their own password here is the only reset path that works.
export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (password.length < 8) {
      setErr("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("The two passwords don't match.");
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setMsg("Password changed. Use it the next time you sign in.");
  }

  return (
    <>
      <SideNav />
      <div className="cp">
        <div className="panel" style={{ maxWidth: 460 }}>
          <h2>Change your password</h2>
          <div className="sub" style={{ marginBottom: 12 }}>
            Pick something only you know. Your username stays the same.
          </div>
          <form onSubmit={onSubmit}>
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <label style={{ marginTop: 10, display: "block" }}>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button className="btn-blue" type="submit" disabled={busy} style={{ width: "100%", marginTop: 16 }}>
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>
          {err && <div className="banner" style={{ marginTop: 14 }}>{err}</div>}
          {msg && <div className="hint" style={{ marginTop: 14 }}>{msg}</div>}
        </div>
      </div>
    </>
  );
}
