import Image from "next/image";
import type { CSSProperties } from "react";
import { accentStyle } from "@/lib/accent";
import type { Candidate } from "@/lib/types";

// Resting tilt per card, like photos pinned by hand. Same size either way, so cards stay equal.
const TILTS = ["-2.2deg", "1.6deg", "-1.2deg", "2deg", "-1.8deg", "1.2deg"];

// A polaroid pinned to the evidence board. The <button> stays still; only .fx-body moves.
export function CandidateCard({
  candidate,
  onSelect,
  disabled,
  index = 0,
}: {
  candidate: Candidate;
  onSelect: (candidate: Candidate) => void;
  disabled?: boolean;
  index?: number;
}) {
  const style = {
    ...accentStyle(candidate.nomor_urut),
    "--rot": TILTS[index % TILTS.length],
    animationDelay: `${150 + index * 110}ms`,
  } as CSSProperties;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(candidate)}
      aria-label={`Paslon ${candidate.nomor_urut}: ${candidate.nama_ketua} dan ${candidate.nama_wakil}`}
      style={style}
      className="fx-card group relative flex h-full min-h-0 w-full animate-drop cursor-pointer text-left disabled:pointer-events-none"
    >
      <div className="fx-body paper relative flex h-full w-full flex-col p-3 pb-0">
        <span aria-hidden className="fx-pin pin absolute -top-3 left-1/2 z-20 size-6" />

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--accent)]">
          {candidate.foto_url ? (
            <Image
              src={candidate.foto_url}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="fx-photo object-cover object-top"
              priority
            />
          ) : null}
          <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgb(40_25_10/0.45)]" />

          <span
            aria-hidden
            className="fx-stamp rubber-stamp absolute right-3 top-3 grid size-20 place-items-center rounded-full bg-surface/70 text-center leading-none"
          >
            <span className="flex flex-col items-center">
              <span className="text-[10px]">Paslon</span>
              <span className="font-display text-4xl font-black tracking-normal">{candidate.nomor_urut}</span>
            </span>
          </span>

          <span aria-hidden className="fx-lens absolute bottom-3 right-3">
            <span className="flex items-center gap-2 rounded-full bg-surface-dark/85 py-1 pl-1 pr-3 font-type text-xs uppercase tracking-widest text-on-dark">
              <LensIcon />
              Periksa
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2 px-1 pb-3 pt-3">
          <span className="font-hand text-2xl font-bold leading-none text-pink">Paslon No. {candidate.nomor_urut}</span>
          <NameRow role="Ketua" name={candidate.nama_ketua} />
          <NameRow role="Wakil" name={candidate.nama_wakil} />
        </div>

        <span className="fx-cta -mx-3 flex items-center justify-between bg-surface-dark px-4 py-2.5 font-type text-sm uppercase tracking-[0.15em] text-on-dark">
          Pilih paslon {candidate.nomor_urut}
          <span aria-hidden className="fx-arrow text-lg">
            →
          </span>
        </span>
      </div>
    </button>
  );
}

function NameRow({ role, name }: { role: string; name: string }) {
  return (
    <span className="flex flex-col border-b border-dashed border-paper-line pb-1">
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">{role}</span>
      <span className="font-type text-lg leading-tight xl:text-xl">{name}</span>
    </span>
  );
}

function LensIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6 rounded-full bg-brass p-1 text-surface-dark" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="10" cy="10" r="6" />
      <path d="M15 15l5 5" />
    </svg>
  );
}
