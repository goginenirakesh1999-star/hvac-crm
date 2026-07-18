import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Nav() {
  const navigate = useNavigate();
  const location = useLocation();

  function goto(id: string) {
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(scroll, 90);
    } else {
      scroll();
    }
  }

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          Rocky<span className="accent">Solutions</span>
        </Link>
        <div className="nav-links">
          <a role="button" onClick={() => goto("services")}>Services</a>
          <a role="button" onClick={() => goto("how")}>How It Works</a>
          <a role="button" onClick={() => goto("assessment")}>Free Assessment</a>
          <a role="button" className="nav-cta" onClick={() => goto("book")}>Book a Call</a>
        </div>
      </div>
    </nav>
  );
}
