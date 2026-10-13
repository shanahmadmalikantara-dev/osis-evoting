import type { ReactNode } from "react";
import { Sticker } from "@/components/ui/Sticker";
import { accentStyle } from "@/lib/accent";
import { percent } from "@/lib/format";
import type { Results } from "@/lib/types";

// Live numbers: summary tiles, one bar per candidate (in the candidate's booth color, so the
// dashboard matches what voters see), and votes per booth.
export function ResultsView({ results }: { results: Results }) {
  const max = Math.max(1, ...results.candidates.map((c) => c.votes));
  const leaderVotes = Math.max(0, ...results.candidates.map((c) => c.votes));
  const leaders = results.candidates.filter((c) => c.votes > 0 && c.votes === leaderVotes);
  const activeBooths = results.booths.filter((b) => b.votes > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total suara masuk" accent="bg-yellow" icon="∑" delay={0}>
          <span data-testid="total-votes" className="font-display text-5xl leading-none tabular-nums">
            {results.total.toLocaleString("id-ID")}
          </span>
        </StatTile>
        <StatTile label="Bilik sudah dipakai" accent="bg-mint" icon="▣" delay={80}>
          <span className="font-display text-5xl leading-none tabular-nums">
            {activeBooths}
            <span className="text-2xl text-ink-soft">/{results.booths.length}</span>
          </span>
        </StatTile>
        <StatTile label="Paslon teratas" accent="bg-pink text-white" icon="▲" delay={160}>
          <span className="font-display text-5xl leading-none">
            {leaders.length === 1 ? `No. ${leaders[0].nomor_urut}` : leaders.length > 1 ? "Seri" : "–"}
          </span>
        </StatTile>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="per-candidate"
          className="fx-tile animate-rise rounded-card border-[3px] border-ink bg-surface p-5 shadow-card [animation-delay:200ms] sm:p-6"
        >
          <h2 id="per-candidate" className="mb-6 font-display text-2xl">
            SUARA PER PASLON
          </h2>

          <ol className="flex flex-col gap-6">
            {results.candidates.map((c) => {
              const width = (c.votes / max) * 100;
              const leading = leaders.length === 1 && leaders[0].id === c.id;
              return (
                <li key={c.id} data-testid={`result-${c.nomor_urut}`} style={accentStyle(c.nomor_urut)} className="group grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="grid size-10 place-items-center rounded-sticker border-[3px] border-ink bg-[var(--accent)] font-display text-xl text-[var(--on-accent)] shadow-[2px_2px_0_var(--color-ink)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                        {c.nomor_urut}
                      </span>
                      <span>
                        {c.nama_ketua} &amp; {c.nama_wakil}
                      </span>
                      {leading ? (
                        <Sticker color="yellow" rotate={-3}>
                          Unggul
                        </Sticker>
                      ) : null}
                    </span>
                    <span className="font-mono text-sm tabular-nums">
                      <strong data-testid="votes" className="text-lg">
                        {c.votes.toLocaleString("id-ID")}
                      </strong>{" "}
                      suara · <span data-testid="percent">{percent(c.votes, results.total)}</span>
                    </span>
                  </div>
                  <div
                    className="h-8 w-full overflow-hidden rounded-sticker border-[3px] border-ink bg-paper"
                    title={`Paslon ${c.nomor_urut}: ${c.votes} suara (${percent(c.votes, results.total)})`}
                  >
                    <div
                      className="fx-bar h-full border-r-[3px] border-ink bg-[var(--accent)]"
                      style={{ width: `${width}%`, minWidth: c.votes > 0 ? 6 : 0, borderRightWidth: c.votes > 0 ? 3 : 0 }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="per-booth"
          className="fx-tile animate-rise rounded-card border-[3px] border-ink bg-surface p-5 shadow-card [animation-delay:280ms] sm:p-6"
        >
          <h2 id="per-booth" className="mb-6 font-display text-2xl">
            PER BILIK
          </h2>
          {results.booths.length === 0 ? (
            <p className="text-ink-soft">Belum ada akun bilik.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {results.booths.map((b) => {
                const share = results.total ? (b.votes / results.total) * 100 : 0;
                return (
                  <li
                    key={b.bilik_id}
                    data-testid={`booth-${b.label}`}
                    className="group flex flex-col gap-2 rounded-sticker border-2 border-ink bg-paper px-3 py-2 transition-[transform,background-color] duration-200 hover:-translate-y-1 hover:bg-mint"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">{b.label}</span>
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${b.votes > 0 ? "bg-green" : "bg-paper-line"}`}
                      />
                    </div>
                    <div className="font-display text-3xl tabular-nums">{b.votes.toLocaleString("id-ID")}</div>
                    <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-paper-line">
                      <div className="fx-bar h-full rounded-full bg-ink" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  accent,
  icon,
  delay,
  children,
}: {
  label: string;
  accent: string;
  icon: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="fx-tile group flex animate-rise items-center gap-4 rounded-card border-[3px] border-ink bg-surface p-5 shadow-card"
    >
      <span
        aria-hidden
        className={`grid size-14 shrink-0 place-items-center rounded-card border-[3px] border-ink font-display text-2xl shadow-[3px_3px_0_var(--color-ink)] transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110 ${accent}`}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">{label}</span>
        {children}
      </div>
    </div>
  );
}
