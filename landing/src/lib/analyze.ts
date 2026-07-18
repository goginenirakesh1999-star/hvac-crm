// Client-side "instant assessment" for the marketing site.
//
// A browser cannot read the HTML of an arbitrary third-party site (CORS), so
// this does NOT claim to have crawled their pages. Instead it performs the
// checks that ARE possible from the browser (HTTPS, reachability, rough
// response time) and pairs them with the revenue-recovery opportunities that
// apply to essentially every owner-operated home-service business. Every
// "gap" item is framed as an opportunity, never as a fabricated defect.

export interface Finding {
  kind: "ok" | "gap" | "info";
  title: string;
  detail: string;
}

export interface Report {
  domain: string;
  score: number; // 0-100 "revenue recovery opportunity" score
  reachable: boolean;
  findings: Finding[];
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.origin + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return null;
  }
}

// Fire a no-cors probe just to see if the origin resolves and roughly how
// quickly. The response is opaque; we only learn reachability + timing.
async function probe(url: string): Promise<{ reachable: boolean; ms: number | null }> {
  const start = performance.now();
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store" });
    return { reachable: true, ms: Math.round(performance.now() - start) };
  } catch {
    return { reachable: false, ms: null };
  }
}

export async function analyze(rawUrl: string): Promise<Report> {
  const url = normalizeUrl(rawUrl)!; // caller validates first
  const { hostname, protocol } = new URL(url);
  const domain = hostname.replace(/^www\./, "");
  const { reachable, ms } = await probe(url);

  const findings: Finding[] = [];

  // --- signals we can genuinely detect from the browser ---
  if (protocol === "https:") {
    findings.push({
      kind: "ok",
      title: "Secure connection (HTTPS)",
      detail: `${domain} loads over a secure connection — good for trust and search ranking.`,
    });
  } else {
    findings.push({
      kind: "gap",
      title: "No secure connection detected",
      detail: `${domain} does not appear to use HTTPS. Customers and Google both penalize insecure sites.`,
    });
  }

  if (reachable && ms !== null) {
    findings.push({
      kind: ms < 1200 ? "ok" : "gap",
      title: ms < 1200 ? "Site responds quickly" : "Slow initial response",
      detail:
        ms < 1200
          ? `Your site responded in about ${ms} ms from this browser.`
          : `Your site took about ${ms} ms to start responding. Slow sites lose mobile visitors before they ever call.`,
    });
  } else {
    findings.push({
      kind: "info",
      title: "Could not measure load time",
      detail: `We couldn't fully reach ${domain} from the browser. We'll verify it manually in your report.`,
    });
  }

  // --- revenue-recovery opportunities every home-service business shares ---
  findings.push(
    {
      kind: "gap",
      title: "Missed-call capture",
      detail:
        "Most home-service calls that go unanswered are never called back. An AI receptionist calls every missed caller back within seconds and books the job.",
    },
    {
      kind: "gap",
      title: "24/7 after-hours answering",
      detail:
        "Emergencies and searches happen nights and weekends. AI answering captures those jobs instead of sending them to voicemail — or a competitor.",
    },
    {
      kind: "gap",
      title: "Speed-to-lead follow-up",
      detail:
        "Leads from your site and ads go cold in minutes. Automatic instant call-and-text follow-up wins the jobs slow responders lose.",
    },
    {
      kind: "gap",
      title: "Online booking & instant quotes",
      detail:
        "Let customers book and receive quotes by text without phone tag. Fewer dropped leads, faster scheduling.",
    },
    {
      kind: "gap",
      title: "Automated Google review requests",
      detail:
        "After each paid job, an automatic text asks for a Google review — the single biggest driver of local ranking and new calls.",
    },
    {
      kind: "info",
      title: "Text-to-pay invoicing",
      detail:
        "Send secure payment links and invoices by text and get paid the same day, straight from your phone.",
    }
  );

  // Score = weighted share of opportunities Rocky Solutions can close.
  const gaps = findings.filter((f) => f.kind === "gap").length;
  const score = Math.min(94, 42 + gaps * 8);

  return { domain, score, reachable, findings };
}

export function reportToText(r: Report, lead: { name: string; email: string; phone: string; url: string }): string {
  const lines = [
    `New instant-assessment lead from the Rocky Solutions site`,
    `----------------------------------------------------------`,
    `Name:    ${lead.name}`,
    `Email:   ${lead.email}`,
    `Phone:   ${lead.phone || "(not provided)"}`,
    `Website: ${lead.url}`,
    `Domain:  ${r.domain}`,
    `Reachable from browser: ${r.reachable ? "yes" : "no"}`,
    `Opportunity score: ${r.score}/100`,
    ``,
    `Findings:`,
    ...r.findings.map((f) => `  [${f.kind.toUpperCase()}] ${f.title} — ${f.detail}`),
  ];
  return lines.join("\n");
}
