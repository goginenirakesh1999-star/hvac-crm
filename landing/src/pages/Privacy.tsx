import { Link } from "react-router-dom";
import { CONTACT_EMAIL, BUSINESS_PHONE, BUSINESS_ADDRESS, isSet } from "../config";

export default function Privacy() {
  return (
    <div className="container legal">
      <Link to="/" className="back-link">← Back to home</Link>
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: July 19, 2026</p>

      <p>Rocky Solutions LLC ("Rocky Solutions," "we," "us," or "our") provides AI-powered communication, scheduling, invoicing, and customer-management software for home service businesses. This Privacy Policy explains how we collect, use, and protect information when you use our services, visit our website, or communicate with a business that uses our platform.</p>

      <h2>Information We Collect</h2>
      <ul>
        <li><strong>Contact information</strong> — such as your name, phone number, and email address, provided when you call, text, submit a form, or book a service.</li>
        <li><strong>Service information</strong> — details about service requests, appointments, quotes, and invoices handled through our platform.</li>
        <li><strong>Communications</strong> — records of calls and text messages processed by our platform, which may include call recordings and transcriptions handled by our AI assistant.</li>
        <li><strong>Payment information</strong> — payments are processed by third-party payment processors (such as Stripe). We do not store full card numbers on our systems.</li>
        <li><strong>Technical information</strong> — basic log and usage data when you visit our website.</li>
      </ul>

      <h2>How We Use Information</h2>
      <ul>
        <li>To provide our services: answering and returning calls, scheduling appointments, sending service confirmations, quotes, invoices, and review requests.</li>
        <li>To improve the reliability and quality of our platform.</li>
        <li>To comply with legal obligations and enforce our terms.</li>
      </ul>

      <h2>Text Messaging (SMS) Privacy</h2>
      <div className="highlight">
        <p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> Text messaging originator opt-in data and consent will not be shared with any third parties, excluding aggregators and providers of the text message services necessary to deliver messages.</p>
      </div>
      <p>Phone numbers collected for SMS consent are used solely to deliver the messages you have agreed to receive — such as appointment confirmations, service updates, payment links, and review requests. You can opt out at any time by replying <strong>STOP</strong> to any message. Reply <strong>HELP</strong> for help.</p>

      <h2>Sharing of Information</h2>
      <p>We share information only with:</p>
      <ul>
        <li>The home service business you are communicating with, so it can perform the requested work;</li>
        <li>Service providers necessary to operate our platform (such as telephony carriers, cloud hosting, and payment processors), bound by their own confidentiality obligations;</li>
        <li>Authorities where required by law.</li>
      </ul>
      <p>We do not sell personal information.</p>

      <h2>Data Retention &amp; Security</h2>
      <p>We retain information for as long as needed to provide our services and meet legal requirements, and we use industry-standard safeguards — including encryption in transit and access controls — to protect it.</p>

      <h2>Your Choices</h2>
      <p>You may request access to, correction of, or deletion of your personal information by contacting us at the address below. To stop receiving text messages, reply <strong>STOP</strong> at any time.</p>

      <h2>Children's Privacy</h2>
      <p>Our services are intended for business use and are not directed to children under 13. We do not knowingly collect information from children.</p>

      <h2>Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. The "Last updated" date above reflects the most recent revision.</p>

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
