import Image from "next/image";
import type { Candidate } from "@/lib/types";

const NUMBER_COLORS = ["bg-yellow", "bg-mint", "bg-pink text-white", "bg-blue text-white"];

export function CandidateCard({
  candidate,
  onSelect,
  disabled,
}: {
  candidate: Candidate;
  onSelect: (candidate: Candidate) => void;
  disabled?: boolean;
}) {
  const color = NUMBER_COLORS[(candidate.nomor_urut - 1) % NUMBER_COLORS.length];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(candidate)}
      aria-label={`Paslon ${candidate.nomor_urut}: ${candidate.nama_ketua} dan ${candidate.nama_wakil}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-card border-2 border-ink bg-surface text-left shadow-card transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-card-hover active:translate-x-0 active:translate-y-0 active:shadow-card disabled:pointer-events-none"
    >
      <div className="relative aspect-[4/5] w-full border-b-2 border-ink bg-paper">
        {candidate.foto_url ? (
          <Image
            src={candidate.foto_url}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover"
            priority
          />
        ) : null}
        <span
          className={`absolute left-3 top-3 grid size-14 place-items-center rounded-sticker border-2 border-ink font-display text-3xl shadow-sticker ${color}`}
        >
          {candidate.nomor_urut}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">Ketua</span>
        <span className="text-lg font-semibold leading-tight">{candidate.nama_ketua}</span>
        <span className="mt-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">Wakil</span>
        <span className="text-lg font-semibold leading-tight">{candidate.nama_wakil}</span>
      </div>
    </button>
  );
}
