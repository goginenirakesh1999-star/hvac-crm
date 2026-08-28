"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "closer" | "caller";

const LINKS: Record<Role, [string, string][]> = {
  admin: [["/admin", "📊 Dashboard"], ["/appointments", "📅 Appointments"], ["/call", "📞 Console"]],
  closer: [["/appointments", "📅 Appointments"], ["/call", "📞 Console"]],
  caller: [["/call", "📞 Console"], ["/appointments", "📅 Appointments"]],
};

export default function SideNav() {
  const path = usePathname();
  const [role, setRole] = useState<Role>("caller");
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) return;
      const { data } = await s.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
      if (data) {
        setRole((data.role as Role) ?? "caller");
        setName(data.full_name ?? "");
      }
    })();
  }, []);

  const links = LINKS[role] ?? LINKS.caller;

  return (
    <nav className="sidenav">
      <div className="sn-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="Rocky Solutions LLC" />
        <span>Rocky Solutions</span>
      </div>
      <div className="sn-links">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={`sn-link ${path === href ? "on" : ""}`}>{label}</Link>
        ))}
      </div>
      <div className="sn-foot">
        {name && <div className="sn-user">{name}<span className="sn-role">{role}</span></div>}
        <form action="/api/auth/signout" method="post">
          <button className="btn-ghost" type="submit" style={{ width: "100%" }}>Sign out</button>
        </form>
      </div>
    </nav>
  );
}
