import type { ReactNode } from "react";

// Outer frame matching the design: grey grid border around a ruled paper page.
export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="flex flex-1 flex-col px-gutter py-8 sm:px-8">
      <div className={`mx-auto flex w-full flex-1 flex-col ${wide ? "max-w-7xl" : "max-w-5xl"}`}>{children}</div>
    </main>
  );
}
