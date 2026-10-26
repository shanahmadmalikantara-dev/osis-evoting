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
  compact = false,
}: {
  candidate: Candidate;
  onSelect: (candidate: Candidate) => void;
  disabled?: boolean;
  index?: number;
  // Phone layout: two narrow cards side by side, so shrink the stamp and labels.
  compact?: boolean;
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
      <div className={`fx-body paper relative flex h-full w-full flex-col pb-0 ${compact ? "p-2" : "p-3"}`}>
        <span aria-hidden className={`fx-pin pin absolute left-1/2 z-20 ${compact ? "-top-2.5 size-5" : "-top-3 size-6"}`} />

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--accent)]">
          {candidate.foto_url ? (
            <Image
              src={candidate.foto_url}
              alt=""
              fill
              unoptimized
              sizes={compact ? "50vw" : "(min-width: 1024px) 25vw, 50vw"}
              className="fx-photo object-cover object-top"
              priority
            />
          ) : null}
          <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgb(40_25_10/0.45)]" />

          <span
            aria-hidden
            className={`fx-stamp rubber-stamp absolute grid place-items-center rounded-full bg-surface/70 text-center leading-none ${compact ? "right-1.5 top-1.5 size-14" : "right-3 top-3 size-20"}`}
          >
            <span className="flex flex-col items-center">
              <span className={compact ? "text-[8px]" : "text-[10px]"}>Paslon</span>
              <span className={`font-display font-black tracking-normal ${compact ? "text-2xl" : "text-4xl"}`}>
                {candidate.nomor_urut}
              </span>
            </span>
          </span>

          <span aria-hidden className={`fx-lens absolute bottom-3 right-3 ${compact ? "hidden" : ""}`}>
            <span className="flex items-center gap-2 rounded-full bg-surface-dark/85 py-1 pl-1 pr-3 font-type text-xs uppercase tracking-widest text-on-dark">
              <LensIcon />
              Periksa
            </span>
          </span>
        </div>

        <div className={`flex flex-col px-1 ${compact ? "gap-1.5 pb-2 pt-2" : "gap-2 pb-3 pt-3"}`}>
          <span className={`font-hand font-bold leading-none text-pink ${compact ? "text-xl" : "text-2xl"}`}>
            Paslon No. {candidate.nomor_urut}
          </span>
          <NameRow role="Ketua" name={candidate.nama_ketua} compact={compact} />
          <NameRow role="Wakil" name={candidate.nama_wakil} compact={compact} />
        </div>

        <span
          className={`fx-cta flex items-center justify-between bg-surface-dark font-type uppercase text-on-dark ${compact ? "-mx-2 px-3 py-2 text-xs tracking-[0.1em]" : "-mx-3 px-4 py-2.5 text-sm tracking-[0.15em]"}`}
        >
          {compact ? "Pilih" : `Pilih paslon ${candidate.nomor_urut}`}
          <span aria-hidden className="fx-arrow text-lg">
            →
          </span>
        </span>
      </div>
    </button>
  );
}

function NameRow({ role, name, compact }: { role: string; name: string; compact?: boolean }) {
  return (
    <span className="flex flex-col border-b border-dashed border-paper-line pb-1">
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">{role}</span>
      <span className={`font-type leading-tight ${compact ? "text-sm" : "text-lg xl:text-xl"}`}>{name}</span>
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
