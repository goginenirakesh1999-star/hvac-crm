import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { analyze, normalizeUrl, reportToText, type Report } from "../lib/analyze";
import { FORMSPREE_ENDPOINT } from "../config";

type Status = "idle" | "running" | "done";

export default function Analyzer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const clean = normalizeUrl(url);
    if (!clean) {
      setError("Please enter a valid website address, e.g. yourcompany.com");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email so we can send your full report.");
      return;
    }

    setStatus("running");
    const result = await analyze(clean);
    setReport(result);
    setStatus("done");

    // Email the lead + report to the owner via Formspree (fire and forget).
    try {
      await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `New website assessment lead: ${result.domain}`,
          name,
          email,
          phone,
          website: clean,
          message: reportToText(result, { name, email, phone, url: clean }),
        }),
      });
    } catch {
      // The customer still sees their report even if the email relay fails.
    }
  }

  return (
    <div className="analyzer">
      {status !== "done" && (
        <form onSubmit={onSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="an-name">Your name</label>
              <input id="an-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
            </div>
            <div className="field">
              <label htmlFor="an-email">Email</label>
              <input id="an-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="an-phone">Phone (optional)</label>
              <input id="an-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="field">
              <label htmlFor="an-url">Your website</label>
              <input id="an-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourcompany.com" required />
            </div>
          </div>
          <button className="btn" type="submit" disabled={status === "running"}>
            {status === "running" ? "Analyzing your site…" : "Get My Free Instant Report →"}
          </button>
          {error && <div className="form-err">{error}</div>}
          <div className="form-note">
            By submitting, you agree to receive occasional calls and text messages from Rocky Solutions LLC
            about your assessment and services. Message frequency varies. Message &amp; data rates may apply.
            Reply STOP to opt out, HELP for help. See our{" "}
            <Link to="/privacy" style={{ color: "var(--blue-2)" }}>Privacy Policy</Link> and{" "}
            <Link to="/terms" style={{ color: "var(--blue-2)" }}>Terms of Service</Link>. We never sell your information.
          </div>
        </form>
      )}

      <AnimatePresence>
        {status === "done" && report && (
          <motion.div
            className="report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="report-head">
              <div className="score-ring" style={{ ["--pct" as string]: report.score }}>
                <div className="inner">{report.score}</div>
              </div>
              <div>
                <h3>Revenue Recovery Report — {report.domain}</h3>
                <p>
                  We found <strong>{report.findings.filter((f) => f.kind === "gap").length} growth opportunities</strong>{" "}
                  Rocky Solutions can automate for you. Your full report is on its way to {email}.
                </p>
              </div>
            </div>

            {report.findings.map((f, i) => (
              <motion.div
                className="finding"
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
              >
                <div className={`badge ${f.kind}`}>{f.kind === "ok" ? "✓" : f.kind === "gap" ? "!" : "i"}</div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.detail}</p>
                </div>
              </motion.div>
            ))}

            <div className="report-cta">
              <a href="#book" className="btn">
                Book Your Free Intro Call →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
