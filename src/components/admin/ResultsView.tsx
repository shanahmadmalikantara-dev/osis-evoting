import type { Results } from "@/lib/types";

export function percent(votes: number, total: number): string {
  if (total === 0) return "0,0%";
  return `${((votes / total) * 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Live numbers: hero total, one horizontal bar per candidate (single hue: the bar length is
// the only thing that differs, the name carries identity), and votes per booth.
export function ResultsView({ results }: { results: Results }) {
  const max = Math.max(1, ...results.candidates.map((c) => c.votes));
  const leaderVotes = Math.max(0, ...results.candidates.map((c) => c.votes));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-labelledby="per-candidate" className="rounded-card border-2 border-ink bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 id="per-candidate" className="font-display text-2xl">
            SUARA PER PASLON
          </h2>
          <div className="text-right">
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">Total suara masuk</div>
            <div data-testid="total-votes" className="font-display text-5xl leading-none tabular-nums">
              {results.total.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        <ol className="flex flex-col gap-5">
          {results.candidates.map((c) => {
            const width = (c.votes / max) * 100;
            const leading = c.votes > 0 && c.votes === leaderVotes;
            return (
              <li key={c.id} data-testid={`result-${c.nomor_urut}`} className="grid gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold">
                    <span className="mr-2 font-display text-lg">{c.nomor_urut}</span>
                    {c.nama_ketua} &amp; {c.nama_wakil}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    <strong data-testid="votes">{c.votes.toLocaleString("id-ID")}</strong> suara ·{" "}
                    <span data-testid="percent">{percent(c.votes, results.total)}</span>
                  </span>
                </div>
                <div
                  className="h-7 w-full border-b-2 border-ink"
                  title={`Paslon ${c.nomor_urut}: ${c.votes} suara (${percent(c.votes, results.total)})`}
                >
                  <div
                    className={`h-full rounded-r-[4px] transition-[width] duration-500 ${leading ? "bg-blue" : "bg-blue/55"}`}
                    style={{ width: `${width}%`, minWidth: c.votes > 0 ? 4 : 0 }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="per-booth" className="rounded-card border-2 border-ink bg-surface p-5 shadow-card sm:p-6">
        <h2 id="per-booth" className="mb-6 font-display text-2xl">
          PER BILIK
        </h2>
        {results.booths.length === 0 ? (
          <p className="text-ink-soft">Belum ada akun bilik.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {results.booths.map((b) => (
              <li key={b.bilik_id} data-testid={`booth-${b.label}`} className="border-2 border-ink bg-paper px-3 py-2">
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">{b.label}</div>
                <div className="font-display text-3xl tabular-nums">{b.votes.toLocaleString("id-ID")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
