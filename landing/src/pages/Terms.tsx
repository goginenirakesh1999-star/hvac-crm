import { Link } from "react-router-dom";
import { CONTACT_EMAIL, BUSINESS_PHONE, BUSINESS_ADDRESS, isSet } from "../config";

export default function Terms() {
  return (
    <div className="container legal">
      <Link to="/" className="back-link">← Back to home</Link>
      <h1>Terms of Service</h1>
      <p className="updated">Last updated: July 19, 2026</p>

      <p>These Terms of Service ("Terms") govern your use of the website, software, and services provided by Rocky Solutions LLC ("Rocky Solutions," "we," "us," or "our"). By using our services or communicating with a business through our platform, you agree to these Terms.</p>

      <h2>Our Services</h2>
      <p>Rocky Solutions provides AI-powered communication and operations software for home service businesses, including automated phone answering, text messaging, appointment scheduling, quoting, invoicing, lead follow-up, and review requests. Calls handled by our platform may be answered by an automated AI assistant and may be recorded and transcribed for quality and service delivery.</p>

      <h2>SMS Terms &amp; Conditions</h2>
      <div className="highlight">
        <p><strong>Program description:</strong> Customers of businesses using the Rocky Solutions platform may receive text messages relating to their service requests — including appointment confirmations and reminders, service updates, quotes, payment links, invoices, and review requests.</p>
        <p><strong>Opt-in:</strong> You consent to receive these messages when you provide your phone number to a participating business — for example by calling, requesting a quote, submitting a contact form, or booking an appointment.</p>
        <p><strong>Message frequency varies</strong> depending on your service activity. <strong>Message and data rates may apply</strong> depending on your mobile carrier plan.</p>
        <p><strong>Opt-out:</strong> Reply <strong>STOP</strong> to any message to cancel and stop receiving further messages. After opting out, you may receive a single confirmation message. Reply <strong>HELP</strong> for help, or contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--blue-2)" }}>{CONTACT_EMAIL}</a>.</p>
        <p><strong>Carriers</strong> are not liable for delayed or undelivered messages.</p>
      </div>

      <h2>Acceptable Use</h2>
      <p>You agree not to misuse our services, including by attempting to disrupt the platform, sending unlawful or abusive content, or using the services to violate any applicable law, including telemarketing and messaging regulations.</p>

      <h2>Payments</h2>
      <p>Payments made through links or invoices sent via our platform are processed by third-party payment processors. The business performing your service — not Rocky Solutions — is the merchant of record for the services you purchase, unless otherwise stated.</p>

      <h2>Intellectual Property</h2>
      <p>The software, website content, and branding of Rocky Solutions LLC are our property or that of our licensors and may not be copied or used without permission.</p>

      <h2>Disclaimers &amp; Limitation of Liability</h2>
      <p>Our services are provided "as is" without warranties of any kind. To the maximum extent permitted by law, Rocky Solutions LLC is not liable for indirect, incidental, or consequential damages arising from use of the services, including missed calls or messages, scheduling errors, or carrier delivery failures.</p>

      <h2>Changes to These Terms</h2>
      <p>We may update these Terms from time to time. Continued use of the services after changes take effect constitutes acceptance of the revised Terms.</p>

      <h2>Governing Law</h2>
      <p>These Terms are governed by the laws of the United States and the state in which Rocky Solutions LLC is organized, without regard to conflict-of-law principles.</p>

      <h2>Contact Us</h2>
      <p>
        Rocky Solutions LLC<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--blue-2)" }}>{CONTACT_EMAIL}</a>
        {isSet(BUSINESS_PHONE) && <><br />Phone: {BUSINESS_PHONE}</>}
        <br />{isSet(BUSINESS_ADDRESS) ? BUSINESS_ADDRESS : "United States"}
      </p>
    </div>
  );
}
