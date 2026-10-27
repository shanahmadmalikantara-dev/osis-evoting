"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { refreshBallot, submitGuruVote, submitVote } from "@/app/pilih/actions";
import { BoothHeader, ClosedScreen, ConfirmModal, ThanksScreen, type Phase } from "@/components/booth/BoothParts";
import { CandidateCard } from "@/components/booth/CandidateCard";
import type { Ballot } from "@/lib/ballot";
import { KELOMPOK, compareKelas, kelompokLabel, type KelompokKey } from "@/lib/kelompok";
import type { RosterVoter } from "@/lib/types";
import { classifyVoteError } from "@/lib/vote-errors";
import { playVoteSound, primeVoteSound } from "@/lib/vote-sound";

const POLL_MS = 10_000;

type Step =
  | { kind: "kelompok" }
  | { kind: "kelas"; kelompok: KelompokKey }
  | { kind: "nama"; kelompok: KelompokKey; kelas: string }
  | { kind: "guru"; nama: string }
  | { kind: "ballot"; voter: RosterVoter };

// Phone voting flow: kelompok -> kelas -> own name -> candidate -> confirm -> thank you (final).
// Teachers (Guru) skip kelas and type their name instead of picking it.
export function VoterApp({ initial }: { initial: Ballot }) {
  const [ballot, setBallot] = useState(initial);
  const [step, setStep] = useState<Step>({ kind: "kelompok" });
  const [phase, setPhase] = useState<Phase>({ kind: "choosing" });
  const [done, setDone] = useState(initial.alreadyVoted);
  // Synchronous lock: blocks a second tap before React re-renders.
  const sendingRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      setBallot(await refreshBallot());
    } catch {
      // Keep the last data; the next poll tries again.
    }
  }, []);

  // Keep status and the "already voted" marks fresh (no login, so polling instead of Realtime).
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => {
      if (!sendingRef.current) void reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [done, reload]);

  const send = useCallback(
    async (voter: RosterVoter, candidateId: string, submissionId: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      // Still inside the tap, so the browser lets us unlock audio for the chime.
      primeVoteSound();
      const candidate = ballot.candidates.find((c) => c.id === candidateId)!;
      setPhase({ kind: "sending", candidate, submissionId });
      try {
        const result =
          voter.kelompok === "guru"
            ? await submitGuruVote(voter.nama, candidateId, submissionId)
            : await submitVote(voter.id, candidateId, submissionId);
        if (result.ok) {
          playVoteSound();
          setDone(true);
        } else {
          setPhase({ kind: "error", candidate, submissionId, error: classifyVoteError(result.error) });
        }
      } catch (error) {
        setPhase({ kind: "error", candidate, submissionId, error: classifyVoteError((error as Error).message) });
      } finally {
        sendingRef.current = false;
      }
    },
    [ballot.candidates],
  );

  if (done) {
    return (
      <ThanksScreen
        message="Suaramu sudah tercatat. Satu orang satu suara, jadi halaman ini sudah selesai. Kamu boleh menutupnya."
      />
    );
  }

  const { election } = ballot;
  if (election.status !== "open" && phase.kind === "choosing") {
    return (
      <ClosedScreen
        status={election.status}
        waitingText="Pemungutan suara belum dibuka. Tunggu aba-aba dari pengawas."
        waitingHint="Halaman terbuka sendiri saat voting dimulai"
      />
    );
  }

  // A group with a single class (e.g. Pimpinan) skips the class step.
  const singleKelas = (kelompok: KelompokKey) => {
    const list = [...new Set(ballot.roster.filter((v) => v.kelompok === kelompok).map((v) => v.kelas))];
    return list.length === 1 ? list[0] : null;
  };

  const backToNames = (voter: RosterVoter) => {
    setPhase({ kind: "choosing" });
    setStep(
      voter.kelompok === "guru"
        ? { kind: "guru", nama: voter.nama }
        : { kind: "nama", kelompok: voter.kelompok as KelompokKey, kelas: voter.kelas },
    );
    void reload();
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      {election.test_mode ? (
        <div role="status" className="booth-tape -mx-gutter flex justify-center py-1.5 shadow-card">
          <span className="px-4 text-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink">
            Mode uji coba · suara ini tidak dihitung
          </span>
        </div>
      ) : null}

      {step.kind === "ballot" ? (
        <>
          <BoothHeader />
          <VoterStrip voter={step.voter} onChange={() => backToNames(step.voter)} />
          <div className="fx-grid relative grid auto-rows-[minmax(21rem,auto)] grid-cols-2 gap-x-3 gap-y-6 pt-2">
            {ballot.candidates.map((candidate, index) => (
              <CandidateCard
                key={candidate.id}
                index={index}
                compact
                candidate={candidate}
                disabled={phase.kind !== "choosing"}
                onSelect={(c) => setPhase({ kind: "confirming", candidate: c })}
              />
            ))}
          </div>
          <ConfirmModal
            phase={phase}
            voter={
              <>
                <strong>{step.voter.nama}</strong> · {step.voter.kelas}
              </>
            }
            onCancel={() => {
              // "Kembali" after "already voted": the name list needs a fresh look.
              if (phase.kind === "error") backToNames(step.voter);
              else setPhase({ kind: "choosing" });
            }}
            onConfirm={(candidate) => send(step.voter, candidate.id, crypto.randomUUID())}
            onRetry={(candidate, submissionId) => send(step.voter, candidate.id, submissionId)}
          />
        </>
      ) : (
        <>
          <StepHeader current={step.kind === "guru" ? "nama" : step.kind} />
          {step.kind === "kelompok" ? (
            <KelompokStep
              roster={ballot.roster}
              onPick={(kelompok) => {
                if (kelompok === "guru") return setStep({ kind: "guru", nama: "" });
                const kelas = singleKelas(kelompok);
                setStep(kelas ? { kind: "nama", kelompok, kelas } : { kind: "kelas", kelompok });
              }}
            />
          ) : step.kind === "guru" ? (
            <GuruStep
              initialNama={step.nama}
              onBack={() => setStep({ kind: "kelompok" })}
              onSubmit={(nama) => {
                setPhase({ kind: "choosing" });
                // No roster row yet: the database creates it when the vote is sent.
                setStep({ kind: "ballot", voter: { id: "", nama, kelas: "Guru", kelompok: "guru", voted: false } });
              }}
            />
          ) : step.kind === "kelas" ? (
            <KelasStep
              roster={ballot.roster}
              kelompok={step.kelompok}
              onBack={() => setStep({ kind: "kelompok" })}
              onPick={(kelas) => setStep({ kind: "nama", kelompok: step.kelompok, kelas })}
            />
          ) : (
            <NamaStep
              roster={ballot.roster}
              kelompok={step.kelompok}
              kelas={step.kelas}
              onBack={() =>
                setStep(singleKelas(step.kelompok) ? { kind: "kelompok" } : { kind: "kelas", kelompok: step.kelompok })
              }
              onPick={(voter) => {
                setPhase({ kind: "choosing" });
                setStep({ kind: "ballot", voter });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

const STEP_LABELS = [
  { kind: "kelompok", label: "Perwakilan" },
  { kind: "kelas", label: "Kelas" },
  { kind: "nama", label: "Nama" },
  { kind: "ballot", label: "Paslon" },
] as const;

// Newspaper clipping with the step tracker.
function StepHeader({ current }: { current: (typeof STEP_LABELS)[number]["kind"] }) {
  const index = STEP_LABELS.findIndex((s) => s.kind === current);
  return (
    <header className="relative animate-drop">
      <span aria-hidden className="tape absolute -left-6 -top-3 z-10 h-6 w-20 -rotate-12" />
      <span aria-hidden className="tape absolute -right-6 -top-3 z-10 h-6 w-20 rotate-12" />
      <div className="newsprint -rotate-[0.6deg] px-4 pb-3 pt-2 text-center">
        <div className="flex items-center justify-between border-b-2 border-ink pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
          <span>Edisi khusus</span>
          <span>MAN 4 Jakarta</span>
        </div>
        <p className="mt-1 font-type text-xs uppercase tracking-[0.25em] text-ink-soft">Pemilihan ketua &amp; wakil MPK</p>
        <h1 className="font-display text-4xl font-black uppercase leading-none tracking-tight">KADERISASI 2026</h1>
        <ol className="mt-3 grid grid-cols-4 gap-1 border-t border-ink/40 pt-2">
          {STEP_LABELS.map((s, i) => (
            <li
              key={s.kind}
              aria-current={i === index ? "step" : undefined}
              className={`flex flex-col items-center gap-1 font-type text-[11px] ${i <= index ? "text-ink" : "text-ink-soft/70"}`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full border-2 font-mono text-xs font-bold ${
                  i < index
                    ? "border-ink bg-ink text-on-dark"
                    : i === index
                      ? "border-pink bg-pink text-white"
                      : "border-ink-soft/50"
                }`}
              >
                {i < index ? "✓" : i + 1}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}

function StepCard({
  file,
  title,
  hint,
  onBack,
  children,
}: {
  file: string;
  title: string;
  hint: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="relative animate-drop pt-8 [animation-delay:120ms]">
      <span aria-hidden className="manila absolute left-4 top-0 h-10 w-40 rounded-t-[6px] shadow-none" />
      <span className="absolute left-8 top-2 font-type text-xs uppercase tracking-widest text-ink-soft">{file}</span>
      <div className="manila relative flex flex-col gap-4 rounded-modal p-4 shadow-card-lift">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-3xl font-black leading-tight">{title}</h2>
          <p className="font-hand text-xl font-bold leading-tight text-ink-soft">{hint}</p>
        </div>
        {children}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex w-fit items-center gap-2 py-1 font-type text-base text-ink underline decoration-dashed underline-offset-4"
          >
            <span aria-hidden>←</span> Kembali
          </button>
        ) : null}
      </div>
    </section>
  );
}

const TILT = ["-0.8deg", "0.6deg", "-0.4deg", "0.9deg"];

function KelompokStep({ roster, onPick }: { roster: RosterVoter[]; onPick: (k: KelompokKey) => void }) {
  return (
    <StepCard file="Langkah 1 dari 4" title="Kamu perwakilan apa?" hint="Pilih sesuai kamu didaftarkan panitia.">
      <div className="flex flex-col gap-3">
        {KELOMPOK.map((k, i) => {
          // Guru is always open: teachers type their name, they are not on the roster.
          const count = k.key === "guru" ? 1 : roster.filter((v) => v.kelompok === k.key).length;
          return (
            <button
              key={k.key}
              type="button"
              disabled={count === 0}
              onClick={() => onPick(k.key)}
              style={{ "--rot": TILT[i % TILT.length] } as CSSProperties}
              className="paper flex rotate-[var(--rot)] items-center justify-between gap-3 rounded-sticker border-2 border-ink px-4 py-4 text-left shadow-sticker transition-transform duration-200 active:translate-y-px active:shadow-none disabled:opacity-50"
            >
              <span className="flex flex-col">
                <span className="font-display text-xl font-black leading-tight">{k.label}</span>
                <span className="font-type text-sm text-ink-soft">{k.hint}</span>
              </span>
              <span aria-hidden className="text-2xl text-pink">
                →
              </span>
            </button>
          );
        })}
      </div>
    </StepCard>
  );
}

function KelasStep({
  roster,
  kelompok,
  onBack,
  onPick,
}: {
  roster: RosterVoter[];
  kelompok: KelompokKey;
  onBack: () => void;
  onPick: (kelas: string) => void;
}) {
  const kelasList = useMemo(
    () => [...new Set(roster.filter((v) => v.kelompok === kelompok).map((v) => v.kelas))].sort(compareKelas),
    [roster, kelompok],
  );
  return (
    <StepCard file="Langkah 2 dari 4" title="Kelas kamu?" hint={kelompokLabel(kelompok)} onBack={onBack}>
      {kelasList.length === 0 ? (
        <p className="font-type text-ink">Belum ada nama di perwakilan ini. Tanya pengawas.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {kelasList.map((kelas) => (
            <button
              key={kelas}
              type="button"
              onClick={() => onPick(kelas)}
              className="paper rounded-sticker border-2 border-ink px-2 py-4 text-center font-display text-xl font-black shadow-sticker transition-transform duration-200 active:translate-y-px active:shadow-none"
            >
              {kelas}
            </button>
          ))}
        </div>
      )}
    </StepCard>
  );
}

function NamaStep({
  roster,
  kelompok,
  kelas,
  onBack,
  onPick,
}: {
  roster: RosterVoter[];
  kelompok: KelompokKey;
  kelas: string;
  onBack: () => void;
  onPick: (voter: RosterVoter) => void;
}) {
  const names = useMemo(
    () =>
      roster
        .filter((v) => v.kelompok === kelompok && v.kelas === kelas)
        .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    [roster, kelompok, kelas],
  );
  return (
    <StepCard
      file="Langkah 3 dari 4"
      title="Yang mana namamu?"
      hint={kelas === kelompokLabel(kelompok) ? kelas : `${kelompokLabel(kelompok)} · ${kelas}`}
      onBack={onBack}
    >
      {names.length === 0 ? (
        <p className="font-type text-ink">Tidak ada nama di kelas ini. Tanya pengawas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {names.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                disabled={v.voted}
                onClick={() => onPick(v)}
                className="paper flex w-full items-center justify-between gap-3 rounded-sticker border-2 border-ink px-4 py-4 text-left shadow-sticker transition-transform duration-200 active:translate-y-px active:shadow-none disabled:border-ink/40 disabled:shadow-none"
              >
                <span className={`font-type text-lg leading-tight ${v.voted ? "text-ink-soft line-through" : ""}`}>
                  {v.nama}
                </span>
                {v.voted ? (
                  <span className="rubber-stamp shrink-0 -rotate-6 px-2 py-0.5 text-[10px] [--stamp:var(--color-blue)]">
                    Sudah memilih
                  </span>
                ) : (
                  <span aria-hidden className="text-2xl text-pink">
                    →
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="font-type text-sm text-ink-soft">
        Pilih namamu sendiri. Namamu tidak ada atau sudah tercoret padahal kamu belum memilih? Lapor ke pengawas.
      </p>
    </StepCard>
  );
}

function GuruStep({
  initialNama,
  onBack,
  onSubmit,
}: {
  initialNama: string;
  onBack: () => void;
  onSubmit: (nama: string) => void;
}) {
  const [nama, setNama] = useState(initialNama);
  const cleaned = nama.trim().replace(/\s+/g, " ");
  const valid = cleaned.length >= 3;
  return (
    <StepCard file="Langkah 3 dari 4" title="Siapa nama Bapak/Ibu?" hint="Guru" onBack={onBack}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(cleaned);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-type text-sm text-ink-soft">Nama lengkap</span>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={120}
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Contoh: Ibu Siti Aminah, S.Pd."
            className="paper rounded-sticker border-2 border-ink px-4 py-3 font-type text-lg text-ink shadow-sticker outline-none focus:border-pink"
          />
        </label>
        <button
          type="submit"
          disabled={!valid}
          className="rounded-sticker border-2 border-ink bg-pink px-4 py-3 font-display text-xl font-black text-white shadow-sticker transition-transform duration-200 active:translate-y-px active:shadow-none disabled:opacity-50"
        >
          Lanjut pilih paslon →
        </button>
      </form>
      <p className="font-type text-sm text-ink-soft">Satu nama hanya bisa memilih satu kali. Tulis nama sendiri, bukan nama orang lain.</p>
    </StepCard>
  );
}

// Who is voting, with a way back if they picked the wrong name.
function VoterStrip({ voter, onChange }: { voter: RosterVoter; onChange: () => void }) {
  return (
    <div className="paper flex -rotate-[0.5deg] items-center justify-between gap-3 px-4 py-2 shadow-sticker">
      <span className="flex min-w-0 flex-col">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-soft">Memilih sebagai</span>
        <span className="truncate font-type text-base">
          <strong>{voter.nama}</strong> · {voter.kelas}
        </span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 font-type text-sm text-pink underline decoration-dashed underline-offset-4"
      >
        Bukan saya
      </button>
    </div>
  );
}
