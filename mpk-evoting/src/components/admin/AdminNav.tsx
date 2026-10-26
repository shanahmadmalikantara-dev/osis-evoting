"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login-action";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: "★" },
  { href: "/admin/pemilih", label: "Pemilih", icon: "●" },
  { href: "/admin/paslon", label: "Paslon", icon: "■" },
  { href: "/admin/audit", label: "Audit log", icon: "◆" },
];

// Top bar styled as the tabs of a case-file cabinet; the active tab sits in front.
export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex animate-fade flex-wrap items-end justify-between gap-3 border-b-4 border-manila">
      <div className="flex flex-wrap items-end gap-1">
        <span className="mb-2 mr-4 hidden items-center gap-2 sm:flex">
          <span className="grid size-9 place-items-center rounded-full bg-surface-dark font-display text-sm font-black text-on-dark shadow-card">
            MP
          </span>
          <span className="font-display text-2xl font-black leading-none text-on-dark [text-shadow:0_2px_4px_rgb(0_0_0/0.5)]">
            Pemilu MPK
          </span>
        </span>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-2 rounded-t-[6px] px-5 font-type text-sm uppercase tracking-widest transition-[padding,background-color,transform] duration-200 ${
                active ? "manila py-3 shadow-none" : "bg-paper/80 py-2 hover:-translate-y-1 hover:bg-manila/90"
              }`}
            >
              <span aria-hidden className="text-pink transition-transform duration-300 group-hover:rotate-[20deg] group-hover:scale-125">
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="mb-2 flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full bg-surface-dark/80 px-3 py-1 font-mono text-xs text-on-dark sm:flex">
          <span aria-hidden className="size-2 rounded-full bg-[#7fd39a]" />
          {email}
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="paper rounded-sticker px-4 py-1.5 font-type text-xs uppercase tracking-widest transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 hover:bg-pink hover:text-white"
          >
            Keluar
          </button>
        </form>
      </div>
    </nav>
  );
}
