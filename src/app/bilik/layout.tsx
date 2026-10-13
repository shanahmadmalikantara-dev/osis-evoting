import type { ReactNode } from "react";
import { KioskGuard } from "@/components/booth/KioskGuard";

// Booth pages: no menu, no links, parchment background. KioskGuard blocks the right-click menu and text selection.
export default function BilikLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 select-none flex-col">
      {/* Aged parchment behind the booth, with darker burnt edges. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-paper">
        <div className="absolute inset-0 bg-[url('/bg/kertas-tua.webp')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgb(60_35_15/0.35)_100%)]" />
      </div>
      <KioskGuard />
      {children}
    </div>
  );
}
