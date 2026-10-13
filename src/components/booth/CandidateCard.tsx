import Image from "next/image";
import type { CSSProperties } from "react";
import type { Candidate } from "@/lib/types";

// One accent per ballot number; the hover ring, number badge and "Pilih" bar use it.
const ACCENTS = [
  { accent: "var(--color-yellow)", onAccent: "var(--color-ink)" },
  { accent: "var(--color-mint)", onAccent: "var(--color-ink)" },
  { accent: "var(--color-pink)", onAccent: "#ffffff" },
  { accent: "var(--color-blue)", onAccent: "#ffffff" },
  { accent: "var(--color-green)", onAccent: "#ffffff" },
  { accent: "var(--color-red)", onAccent: "#ffffff" },
];

export function candidateAccent(nomorUrut: number) {
  return ACCENTS[(nomorUrut - 1) % ACCENTS.length];
}

export function accentStyle(nomorUrut: number): CSSProperties {
  const { accent, onAccent } = candidateAccent(nomorUrut);
  return { "--accent": accent, "--on-accent": onAccent } as CSSProperties;
}

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
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(candidate)}
      aria-label={`Paslon ${candidate.nomor_urut}: ${candidate.nama_ketua} dan ${candidate.nama_wakil}`}
      style={{ ...accentStyle(candidate.nomor_urut), animationDelay: `${120 + index * 90}ms` }}
      className="booth-card flex h-full min-h-0 w-full animate-rise cursor-pointer flex-col rounded-card border-[3px] border-ink bg-surface text-left shadow-card disabled:pointer-events-none"
    >
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-hidden rounded-t-[7px] border-b-[3px] border-ink bg-[var(--accent)]">
          {candidate.foto_url ? (
            <Image
              src={candidate.foto_url}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="booth-photo object-cover object-top"
              priority
            />
          ) : null}
          <span aria-hidden className="booth-shine absolute inset-y-0 left-0 w-1/3 bg-white/35" />
        </div>
        <span
          aria-hidden
          className="booth-number absolute -bottom-7 left-4 grid size-16 place-items-center rounded-sticker border-[3px] border-ink bg-[var(--accent)] font-display text-4xl text-[var(--on-accent)] shadow-[3px_3px_0_var(--color-ink)]"
        >
          {candidate.nomor_urut}
        </span>
      </div>

      <div className="flex flex-col gap-2 px-5 pb-4 pt-10">
        <NameRow role="Ketua" name={candidate.nama_ketua} />
        <NameRow role="Wakil" name={candidate.nama_wakil} />
      </div>

      <span className="booth-cta flex items-center justify-between rounded-b-[7px] border-t-[3px] border-ink bg-ink px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest text-on-dark">
        Pilih paslon {candidate.nomor_urut}
        <span aria-hidden className="booth-arrow text-lg">
          →
        </span>
      </span>
    </button>
  );
}

function NameRow({ role, name }: { role: string; name: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">{role}</span>
      <span className="text-lg font-semibold leading-tight xl:text-xl">{name}</span>
    </span>
  );
}
