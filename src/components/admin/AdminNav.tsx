"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login-action";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: "★" },
  { href: "/admin/paslon", label: "Paslon", icon: "■" },
  { href: "/admin/audit", label: "Audit log", icon: "◆" },
];

// Top bar in the style of the design reference: yellow active pill, mono uppercase labels.
export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest ${
                active ? "bg-yellow" : "hover:bg-paper"
              }`}
            >
              <span aria-hidden>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden font-mono text-xs text-ink-soft sm:inline">{email}</span>
        <form action={logout}>
          <button
            type="submit"
            className="border-2 border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest hover:bg-pink hover:text-white"
          >
            Keluar
          </button>
        </form>
      </div>
    </nav>
  );
}
