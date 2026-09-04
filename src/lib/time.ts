// Every time shown in the app is Eastern (New York), never the viewer's own
// clock. The team works US dealers from other timezones, so a browser-local
// timestamp would read IST on one screen and ET on another for the same call.
// Pinning it here means a time in the CRM always means the same instant to
// everyone, and matches the clock the dealer being called is on.
export const CALL_TZ = "America/New_York";

const DTF = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: CALL_TZ, ...opts });

/** "Sep 4, 3:07 PM" — compact, for lists and history rows. */
export function fmtET(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return DTF({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

/** "Sep 4, 2026, 3:07 PM ET" — explicit, for stamps and detail rows. */
export function fmtETFull(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "";
  const s = DTF({
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(d);
  return `${s} ET`;
}

/** "3:07 PM" — time only. */
export function fmtETTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return DTF({ hour: "numeric", minute: "2-digit" }).format(d);
}

/** "Thursday, Sep 4" — day heading. */
export function fmtETDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return DTF({ weekday: "long", month: "short", day: "numeric" }).format(d);
}

// How far the given instant's wall clock in CALL_TZ sits from UTC.
function offsetMs(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CALL_TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUTC - at.getTime();
}

/**
 * The instant Eastern midnight last occurred — the start of "today" for
 * call counts and daily targets. Without this, a caller in IST rolls over
 * to a new day nine and a half hours early and their daily count resets
 * mid-afternoon Eastern.
 */
export function etDayStart(now: Date = new Date()): Date {
  const shift = (at: Date) => {
    const local = new Date(at.getTime() + offsetMs(at));
    local.setUTCHours(0, 0, 0, 0);
    return local;
  };
  const first = shift(now);
  // Re-derive the offset at the candidate midnight so the two DST changeover
  // days don't land an hour out.
  return new Date(first.getTime() - offsetMs(new Date(first.getTime() - offsetMs(now))));
}

/** Is this instant on the current Eastern calendar day? */
export function isETToday(iso: string): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const day = DTF({ year: "numeric", month: "2-digit", day: "2-digit" });
  return day.format(d) === day.format(new Date());
}
