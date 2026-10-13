"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login-action";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: "★" },
  { href: "/admin/paslon", label: "Paslon", icon: "■" },
  { href: "/admin/audit", label: "Audit log", icon: "◆" },
];

// Top bar: brand on the left, pill links (yellow when active), account + logout on the right.
export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex animate-fade flex-wrap items-center justify-between gap-3 rounded-card border-[3px] border-ink bg-surface px-3 py-2 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 hidden items-center gap-2 border-r-2 border-paper-line pr-4 sm:flex">
          <span className="grid size-8 place-items-center rounded-sticker border-2 border-ink bg-yellow font-display text-sm">
            OS
          </span>
          <span className="font-display text-lg leading-none">PEMILU OSIS</span>
        </span>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 ${
                active ? "border-ink bg-yellow shadow-sticker" : "border-transparent hover:border-ink hover:bg-paper"
              }`}
            >
              <span aria-hidden className="transition-transform duration-300 group-hover:rotate-[20deg] group-hover:scale-125">
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full bg-paper px-3 py-1 font-mono text-xs text-ink-soft sm:flex">
          <span aria-hidden className="size-2 rounded-full bg-green" />
          {email}
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-full border-2 border-ink px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 hover:bg-pink hover:text-white"
          >
            Keluar
          </button>
        </form>
      </div>
    </nav>
  );
}
