import { Link } from "react-router-dom";
import { CONTACT_EMAIL, BUSINESS_PHONE, BUSINESS_ADDRESS, isSet } from "../config";

export default function Refund() {
  return (
    <div className="container legal">
      <Link to="/" className="back-link">← Back to home</Link>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className="updated">Last updated: July 19, 2026</p>

      <p>This Refund &amp; Cancellation Policy applies to services purchased directly from Rocky Solutions LLC ("Rocky Solutions," "we," "us," or "our").</p>

      <h2>Subscription Services</h2>
      <p>Rocky Solutions provides software services to home service businesses on a subscription basis. Subscriptions are billed in advance for each service period (for example, monthly).</p>

      <h2>Cancellations</h2>
      <p>You may cancel your subscription at any time by contacting us using the details below. Cancellation stops future billing. Your services remain active through the end of the current paid billing period, after which they will not renew.</p>

      <h2>Refunds</h2>
      <ul>
        <li>Setup and onboarding fees are non-refundable once configuration work has begun.</li>
        <li>Subscription fees for the current billing period are generally non-refundable, as services are delivered continuously throughout the period.</li>
        <li>If you believe you were billed in error, contact us within 30 days of the charge and we will review the charge and issue a refund where appropriate.</li>
        <li>Per-usage charges passed through from third-party providers (such as telephony minutes and messaging) are non-refundable once incurred.</li>
      </ul>

      <h2>Payments to Home Service Businesses</h2>
      <p>Payments you make to a home service business through a link or invoice sent via our platform are between you and that business, who is the merchant of record for those services. Refunds for completed or scheduled work are handled directly by that business according to their own policies.</p>

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
