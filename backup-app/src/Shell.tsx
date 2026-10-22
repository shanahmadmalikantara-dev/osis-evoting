import { useEffect, type ReactNode } from "react";

// Same parchment backdrop as the website's /bilik pages; no right-click menu.
export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-y-auto px-gutter py-5 select-none sm:px-8">
      <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10 bg-paper">
        <div className="absolute inset-0 bg-[url('/bg/kertas-tua.webp')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgb(60_35_15/0.35)_100%)]" />
      </div>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">{children}</div>
    </main>
  );
}

// Manila case folder used by the setup and officer screens.
export function Folder({ tab, children, wide = false }: { tab: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`relative mx-auto w-full animate-drop pt-8 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
      <span aria-hidden className="manila absolute left-8 top-0 h-10 w-56 rounded-t-[6px] shadow-none" />
      <span className="absolute left-12 top-2 font-type text-sm uppercase tracking-widest text-ink-soft">{tab}</span>
      <div className="manila relative flex flex-col gap-6 rounded-modal px-6 py-8 shadow-card-lift sm:px-10">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-type text-xs uppercase tracking-widest text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "rounded-sticker border-2 border-ink/40 bg-surface px-4 py-3 font-mono text-lg outline-none focus:border-pink disabled:opacity-60";
