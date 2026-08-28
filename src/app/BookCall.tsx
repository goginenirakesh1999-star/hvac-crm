"use client";

import { useEffect } from "react";
import { getCalApi } from "@calcom/embed-react";

const NS = "quick-intro-of-the-services";
const LINK = "rakesh-gogineni-udonap/quick-intro-of-the-services";

interface Ctx {
  leadId?: string;
  name?: string | null;
  email?: string | null;
  business?: string | null;
  phone?: string;
  notes?: string;
}

// The client's confirmation is sent by Cal.com to whatever email the booker
// types in the Cal form — so no per-caller Google account is needed. When a
// booking with lead context succeeds we also mirror it into our appointments
// table (attributed to the signed-in user server-side), so the caller sees
// their own bookings and the closer/admin see all.
let currentCtx: Ctx | null = null;
let subscribed = false;

async function ensureCal() {
  if (subscribed) return;
  subscribed = true;
  const cal = await getCalApi({ namespace: NS });
  cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
  cal("on", {
    action: "bookingSuccessful",
    callback: (e: unknown) => {
      const ctx = currentCtx;
      if (!ctx?.phone) return;
      const detail = (e as { detail?: { data?: Record<string, unknown> } })?.detail?.data ?? {};
      const booking = detail.booking as Record<string, unknown> | undefined;
      const start = (detail.date || detail.startTime || booking?.startTime) as string | undefined;
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_name: ctx.name ?? null,
          prospect_business: ctx.business ?? null,
          prospect_phone: ctx.phone,
          prospect_email: ctx.email ?? null,
          scheduled_at: start ? new Date(start).toISOString() : new Date().toISOString(),
          notes: `Booked via Cal.com${ctx.notes ? " · " + ctx.notes : ""}`,
          lead_id: ctx.leadId ?? null,
        }),
      }).catch(() => {});
    },
  });
}

export default function BookCall({
  ctx,
  mirror = false,
  label = "📆 Schedule meeting",
  className = "btn-blue",
}: {
  ctx?: Ctx;
  mirror?: boolean;
  label?: string;
  className?: string;
}) {
  useEffect(() => {
    ensureCal();
    if (mirror && ctx) {
      currentCtx = ctx;
      return () => {
        if (currentCtx === ctx) currentCtx = null;
      };
    }
  }, [mirror, ctx]);

  const config: Record<string, string> = { layout: "month_view", useSlotsViewOnSmallScreen: "true" };
  if (ctx?.name) config.name = ctx.name;
  if (ctx?.email) config.email = ctx.email;
  if (ctx?.notes) config.notes = ctx.notes;

  return (
    <button className={className} data-cal-namespace={NS} data-cal-link={LINK} data-cal-config={JSON.stringify(config)}>
      {label}
    </button>
  );
}
