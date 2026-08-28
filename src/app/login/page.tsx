"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth";
import Quote from "../Quote";
import "../call/call.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) {
      setError("Wrong username or password.");
      setBusy(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="cp hero" style={{ display: "grid", placeItems: "center", ["--wall" as string]: "url(/wallpapers/aurora1.jpg)" } as React.CSSProperties}>
      <div className="panel" style={{ width: "100%", maxWidth: 400 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login-logo" src="/logo-lockup.png" alt="Rocky Solutions LLC" width={400} height={310} />
        <div className="sub" style={{ marginBottom: 8, textAlign: "center" }}>Sign in to the call console.</div>
        <Quote hero />
        <form onSubmit={onSubmit}>
          <label>Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. rakesh" />
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
