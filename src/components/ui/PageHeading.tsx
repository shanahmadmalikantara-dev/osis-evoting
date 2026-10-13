// Page title as a newspaper clipping taped to the board.
export function PageHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="relative w-fit animate-drop">
      <span aria-hidden className="tape absolute -left-6 -top-2 z-10 h-6 w-20 -rotate-12" />
      <div className="newsprint -rotate-1 px-8 py-3">
        <p className="font-type text-xs uppercase tracking-[0.3em] text-ink-soft">{kicker}</p>
        <h1 className="font-display text-5xl font-black uppercase leading-none tracking-tight sm:text-6xl">{title}</h1>
      </div>
    </header>
  );
}
