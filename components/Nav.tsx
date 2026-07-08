"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log Day" },
  { href: "/profile", label: "Profile" },
  { href: "/review-decision-1", label: "Review Decision #1" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="top-nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
