import type { CSSProperties, ReactNode } from "react";
import { accentStyle } from "@/lib/accent";
import { percent } from "@/lib/format";
import type { Results } from "@/lib/types";

// Live numbers on the evidence board: index cards for the summary, a typed report with one bar
// per candidate (in the candidate's booth color), and one postage stamp per booth.
export function ResultsView({ results }: { results: Results }) {
  const max = Math.max(1, ...results.candidates.map((c) => c.votes));
  const leaderVotes = Math.max(0, ...results.candidates.map((c) => c.votes));
  const leaders = results.candidates.filter((c) => c.votes > 0 && c.votes === leaderVotes);
  const activeBooths = results.booths.filter((b) => b.votes > 0).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-3">
        <IndexCard label="Total suara masuk" rot="-1.2deg" delay={0}>
          <span data-testid="total-votes" className="font-display text-6xl font-black leading-none tabular-nums">
            {results.total.toLocaleString("id-ID")}
          </span>
        </IndexCard>
        <IndexCard label="Bilik sudah dipakai" rot="0.8deg" delay={90}>
          <span className="font-display text-6xl font-black leading-none tabular-nums">
            {activeBooths}
            <span className="text-3xl text-ink-soft">/{results.booths.length}</span>
          </span>
        </IndexCard>
        <IndexCard label="Paslon teratas" rot="-0.6deg" delay={180}>
          <span className="font-display text-6xl font-black leading-none">
            {leaders.length === 1 ? `No. ${leaders[0].nomor_urut}` : leaders.length > 1 ? "Seri" : "–"}
          </span>
        </IndexCard>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="per-candidate"
          style={{ "--tile-rot": "-0.3deg" } as CSSProperties}
          className="fx-tile paper relative animate-rise p-5 [animation-delay:200ms] sm:p-7"
        >
          <span aria-hidden className="pin absolute -top-2 left-8 size-5" />
          <span aria-hidden className="pin absolute -top-2 right-8 size-5" />
          <h2 id="per-candidate" className="mb-1 font-display text-3xl font-black">
            Laporan suara per paslon
          </h2>
          <p className="mb-6 border-b-2 border-ink pb-2 font-type text-xs uppercase tracking-widest text-ink-soft">
            Diperbarui otomatis · {results.total.toLocaleString("id-ID")} suara dihitung
          </p>

          <ol className="flex flex-col gap-6">
            {results.candidates.map((c) => {
              const width = (c.votes / max) * 100;
              const leading = leaders.length === 1 && leaders[0].id === c.id;
              return (
                <li key={c.id} data-testid={`result-${c.nomor_urut}`} style={accentStyle(c.nomor_urut)} className="group grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="flex items-center gap-3">
                      <span className="rubber-stamp grid size-11 place-items-center rounded-full font-display text-xl font-black tracking-normal transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
                        {c.nomor_urut}
                      </span>
                      <span className="font-type text-base">
                        {c.nama_ketua} &amp; {c.nama_wakil}
                      </span>
                      {leading ? (
                        <span className="rubber-stamp -rotate-6 px-2 py-0.5 text-[11px] [--stamp:var(--color-success)]">Unggul</span>
                      ) : null}
                    </span>
                    <span className="font-mono text-sm tabular-nums">
                      <strong data-testid="votes" className="font-display text-2xl font-black">
                        {c.votes.toLocaleString("id-ID")}
                      </strong>{" "}
                      suara · <span data-testid="percent">{percent(c.votes, results.total)}</span>
                    </span>
                  </div>
                  <div
                    className="h-7 w-full overflow-hidden rounded-sticker bg-paper shadow-[inset_0_1px_3px_rgb(40_25_10/0.3)]"
                    title={`Paslon ${c.nomor_urut}: ${c.votes} suara (${percent(c.votes, results.total)})`}
                  >
                    <div
                      className="fx-bar h-full bg-[var(--accent)] bg-[linear-gradient(90deg,transparent_0_calc(100%-3px),rgb(42_29_20/0.6)_calc(100%-3px))] shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)]"
                      style={{ width: `${width}%`, minWidth: c.votes > 0 ? 6 : 0 }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="per-booth"
          style={{ "--tile-rot": "0.4deg" } as CSSProperties}
          className="fx-tile manila relative animate-rise p-5 [animation-delay:280ms] sm:p-7"
        >
          <span aria-hidden className="tape absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2" />
          <h2 id="per-booth" className="mb-6 font-display text-3xl font-black">
            Per bilik
          </h2>
          {results.booths.length === 0 ? (
            <p className="font-type text-ink-soft">Belum ada akun bilik.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4">
              {results.booths.map((b, i) => (
                <li
                  key={b.bilik_id}
                  data-testid={`booth-${b.label}`}
                  style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}
                  className="group drop-shadow-[1px_3px_3px_rgb(40_25_10/0.45)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
                >
                  <div className="stamp-edge bg-surface">
                    <div className="relative flex flex-col gap-1 border border-ink/30 bg-paper px-2 py-2">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">{b.label}</span>
                      <span className="font-display text-3xl font-black tabular-nums">{b.votes.toLocaleString("id-ID")}</span>
                      {b.votes > 0 ? (
                        <span
                          aria-hidden
                          className="rubber-stamp absolute bottom-1 right-1 grid size-9 -rotate-12 place-items-center rounded-full text-[8px] leading-none"
                        >
                          Aktif
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// Lined index card pinned to the board.
function IndexCard({ label, rot, delay, children }: { label: string; rot: string; delay: number; children: ReactNode }) {
  return (
    <div
      style={{ rotate: rot, animationDelay: `${delay}ms` } as CSSProperties}
      className="fx-tile paper-ruled relative flex animate-drop flex-col gap-2 py-5 pl-14 pr-5"
    >
      <span aria-hidden className="pin absolute -top-2 left-1/2 size-5 -translate-x-1/2" />
      <span className="font-type text-xs uppercase tracking-widest text-pink">{label}</span>
      {children}
    </div>
  );
}
