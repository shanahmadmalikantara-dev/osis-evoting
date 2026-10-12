import type { ReactNode } from "react";
import { KioskGuard } from "@/components/booth/KioskGuard";

// Booth pages: no menu, no links. KioskGuard blocks the right-click menu and text selection.
export default function BilikLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 select-none flex-col">
      <KioskGuard />
      {children}
    </div>
  );
}
