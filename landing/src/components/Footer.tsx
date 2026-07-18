import { Link } from "react-router-dom";
import { CONTACT_EMAIL, BUSINESS_PHONE, isSet } from "../config";

export default function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        <div>
          <div style={{ color: "var(--muted)", fontWeight: 600 }}>Rocky Solutions LLC</div>
          <div>© 2026 Rocky Solutions LLC. All rights reserved.</div>
          <div>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            {isSet(BUSINESS_PHONE) && ` · ${BUSINESS_PHONE}`}
          </div>
        </div>
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/refund">Refund Policy</Link>
        </div>
      </div>
    </footer>
  );
}
