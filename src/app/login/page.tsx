"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "../call/call.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/call";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="cp" style={{ display: "grid", placeItems: "center" }}>
      <div className="panel" style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Rocky Solutions</h1>
        <div className="sub" style={{ marginBottom: 18 }}>Sign in to the call console.</div>
        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <label style={{ marginTop: 10, display: "block" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <button className="btn-blue" type="submit" disabled={busy} style={{ width: "100%", marginTop: 16 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {error && <div className="banner" style={{ marginTop: 14 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
