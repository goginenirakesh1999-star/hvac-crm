"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";

export type DialStatus = "idle" | "connecting" | "live";

export interface FinishedCall {
  durationSec: number;
  callSid: string;
}

// Browser softphone shared by the caller console and the closer agenda.
// `onFinish` fires once per call with the real talk duration (0 if never
// answered) and the Twilio CallSid, so each page can log/record as it needs.
export function useDialer(onFinish?: (info: FinishedCall) => void) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<DialStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredAtRef = useRef<number>(0); // >0 only once the call is answered
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

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

  function finish() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const durationSec = answeredAtRef.current > 0
      ? Math.floor((Date.now() - answeredAtRef.current) / 1000)
      : 0;
    const callSid = (callRef.current?.parameters?.CallSid as string) || "";
    callRef.current = null;
    answeredAtRef.current = 0;
    setStatus("idle");
    setSeconds(0);
    setMuted(false);
    onFinishRef.current?.({ durationSec, callSid });
  }

  async function call(number: string, record: boolean): Promise<void> {
    if (status !== "idle") return;
    setError("");
    setMuted(false);
    setSeconds(0);
    answeredAtRef.current = 0;
    setStatus("connecting");
    const device = await connectDevice();
    if (!device) {
      setStatus("idle");
      return;
    }
    try {
      const c = await device.connect({ params: { To: number, Record: record ? "1" : "0" } });
      callRef.current = c;
      c.on("accept", () => {
        answeredAtRef.current = Date.now();
        setStatus("live");
        timerRef.current = setInterval(() => {
          setSeconds(Math.floor((Date.now() - answeredAtRef.current) / 1000));
        }, 1000);
      });
      c.on("disconnect", finish);
      c.on("cancel", finish);
      c.on("error", (e: { message: string }) => {
        setError(e.message);
        finish();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call failed.");
      setStatus("idle");
    }
  }

  function hangup() {
    callRef.current?.disconnect();
  }

  function sendDigits(key: string) {
    callRef.current?.sendDigits(key);
  }

  function toggleMute() {
    const c = callRef.current;
    if (!c) return;
    const next = !muted;
    c.mute(next);
    setMuted(next);
  }

  return {
    ready, error, status, seconds, muted,
    setError, connectDevice, call, hangup, sendDigits, toggleMute,
  };
}
