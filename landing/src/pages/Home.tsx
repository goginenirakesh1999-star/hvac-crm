import { motion } from "framer-motion";
import { Reveal, RevealGroup, Item, fadeUp } from "../components/motion";
import Analyzer from "../components/Analyzer";
import Calendly from "../components/Calendly";
import { CONTACT_EMAIL, BUSINESS_PHONE, BUSINESS_ADDRESS, isSet } from "../config";

const SERVICES = [
  {
    icon: "📞",
    title: "24/7 AI Phone Answering",
    body: "When you can't pick up, our AI receptionist calls the customer right back within seconds — day or night. It answers common questions, explains your diagnostic fee, checks your service area, and books the appointment directly onto your calendar, so no lead ever hits a dead-end voicemail again.",
  },
  {
    icon: "💬",
    title: "Missed-Call Text-Back & SMS Dispatch",
    body: "Run your entire business from the phone in your pocket. Every missed call triggers an instant text-back, and job confirmations, dispatch updates, and new-lead alerts all arrive by SMS the moment they happen. Reply to a text to quote, invoice, or update a job — no app to learn.",
  },
  {
    icon: "🧾",
    title: "Instant Quotes, Invoices & Payments",
    body: "Send a professional payment link or invoice to any customer by text in seconds. Type QUOTE or INVOICE with the amount and we generate a secure Stripe checkout link and text it straight to them. Get paid the same day — funds flow directly to your account.",
  },
  {
    icon: "⚡",
    title: "Speed-to-Lead Follow-Up",
    body: "Leads from Facebook, Google, and your website go cold within minutes. The instant a lead comes in, our system calls and texts them automatically — before your competitor has even seen the notification. Be the first to respond and win the job every time.",
  },
  {
    icon: "🔁",
    title: "Customer Reactivation Campaigns",
    body: "Your past customer list is a goldmine. Launch automated seasonal tune-up reminders and win-back campaigns that call and text your existing contacts on a throttled, carrier-friendly schedule — filling your calendar during slow weeks without lifting a finger.",
  },
  {
    icon: "⭐",
    title: "Review & Reputation Management",
    body: "After every paid job, customers automatically receive a friendly text asking for a Google review at the perfect moment. More 5-star reviews means higher local search ranking, more trust, and a steady stream of new inbound calls — all on autopilot.",
  },
];

const STEPS = [
  { n: "01", t: "Connect Your Number", d: "We provision a dedicated business line and connect it to your existing number and calendar. Nothing about how customers reach you changes." },
  { n: "02", t: "Train Your AI Assistant", d: "We configure the assistant with your services, pricing, service area, and booking rules so it sounds like your sharpest office manager." },
  { n: "03", t: "Run It From Your Pocket", d: "Every call, lead, job, and payment flows to your phone by text. Send quotes and invoices with a single message and watch jobs book themselves." },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <header className="hero">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="pill">
              <span className="dot" /> AI Dispatch &amp; Revenue Recovery for Home Service Pros
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}>
            Never Miss Another <span className="grad">Customer Call</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }}>
            Rocky Solutions LLC gives HVAC and home service companies an AI that answers calls, books jobs, sends invoices, and follows up with leads — automatically, 24/7.
          </motion.p>
          <motion.div className="hero-cta" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }}>
            <a href="#assessment" className="btn">Get a Free Website Assessment →</a>
            <a href="#book" className="btn ghost">Book an Intro Call</a>
          </motion.div>
          <motion.div className="hero-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}>
            <div className="hero-stat"><div className="n">24/7</div><div className="l">AI call answering</div></div>
            <div className="hero-stat"><div className="n">&lt;30s</div><div className="l">Speed-to-lead callback</div></div>
            <div className="hero-stat"><div className="n">100%</div><div className="l">Run from your phone</div></div>
          </motion.div>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services">
        <div className="container">
          <Reveal>
            <div className="eyebrow">What We Do</div>
            <h2 className="section-title">Everything Your Front Office Should Do — Automated</h2>
            <p className="section-lede">A complete digital dispatcher and revenue-recovery platform, built for owner-operated service businesses that live on the phone.</p>
          </Reveal>
          <RevealGroup className="grid">
            {SERVICES.map((s) => (
              <Item className="card" key={s.title}>
                <div className="ico">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Item>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="container">
          <Reveal>
            <div className="eyebrow">How It Works</div>
            <h2 className="section-title">Live in Days, Not Months</h2>
            <p className="section-lede">You keep your existing phone number and workflow — we just make it smarter.</p>
          </Reveal>
          <RevealGroup className="steps">
            {STEPS.map((s) => (
              <Item className="step" key={s.n}>
                <div className="num">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </Item>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ASSESSMENT */}
      <section id="assessment">
        <div className="container">
          <Reveal>
            <div className="eyebrow center">Free Instant Assessment</div>
            <h2 className="section-title center">See What You're Missing in 30 Seconds</h2>
            <p className="section-lede center">Enter your website and we'll show you — instantly — where you're leaking calls, leads, and revenue, then email you a detailed recovery report.</p>
          </Reveal>
          <Reveal variants={fadeUp}>
            <Analyzer />
          </Reveal>
        </div>
      </section>

      {/* BOOK / CALENDLY */}
      <section id="book">
        <div className="container">
          <Reveal>
            <div className="eyebrow center">Book a Call</div>
            <h2 className="section-title center">Schedule Your Free Intro Call</h2>
            <p className="section-lede center">Pick a time that works for you. We'll walk through your setup and show you exactly how much revenue you can recover.</p>
          </Reveal>
          <Reveal>
            <div style={{ marginTop: 40 }}>
              <Calendly />
            </div>
          </Reveal>
        </div>
      </section>

      {/* SMS DISCLOSURE */}
      <section id="sms">
        <div className="container">
          <Reveal>
            <div className="eyebrow">SMS Program Disclosure</div>
            <h2 className="section-title">Messaging You Can Trust</h2>
            <p className="section-lede">Rocky Solutions LLC sends text messages on behalf of the home service businesses that use our platform, in full compliance with U.S. carrier requirements.</p>
          </Reveal>
          <RevealGroup className="grid">
            <Item className="card">
              <h3>Opt-In</h3>
              <p>Customers receive messages only after providing their phone number and consenting to be contacted — for example when calling a business, requesting a quote, submitting a web form, or booking a service appointment.</p>
            </Item>
            <Item className="card">
              <h3>Opt-Out</h3>
              <p>Reply <strong>STOP</strong> to any message to unsubscribe at any time. Reply <strong>HELP</strong> for assistance. Message frequency varies. Message &amp; data rates may apply.</p>
            </Item>
            <Item className="card">
              <h3>Your Data</h3>
              <p>Mobile numbers and SMS consent are never sold or shared with third parties for marketing. See our <a href="/privacy" style={{ color: "var(--blue-2)" }}>Privacy Policy</a> and <a href="/terms" style={{ color: "var(--blue-2)" }}>Terms of Service</a>.</p>
            </Item>
          </RevealGroup>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact">
        <div className="container">
          <Reveal>
            <div className="eyebrow">Contact</div>
            <h2 className="section-title">Let's Talk</h2>
            <p className="section-lede">Questions about our services, partnerships, or an existing message program? We'd love to hear from you.</p>
            <div className="contact-box">
              <p style={{ fontWeight: 700, color: "var(--text)" }}>Rocky Solutions LLC</p>
              <p>Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
              {isSet(BUSINESS_PHONE) && (
                <p>Phone: <a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}`}>{BUSINESS_PHONE}</a></p>
              )}
              <p style={{ color: "var(--muted)" }}>{isSet(BUSINESS_ADDRESS) ? BUSINESS_ADDRESS : "United States"}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
