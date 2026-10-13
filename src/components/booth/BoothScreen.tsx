"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { CandidateCard, accentStyle } from "@/components/booth/CandidateCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Sticker } from "@/components/ui/Sticker";
import { authorizeRealtime, getBrowserClient } from "@/lib/supabase/browser";
import type { Candidate, ElectionState } from "@/lib/types";
import { RETRYABLE, VOTE_ERROR_TEXT, classifyVoteError, type VoteErrorKind } from "@/lib/vote-errors";

export const CONFIRM_TIMEOUT_SECONDS = 60;
export const THANKS_SECONDS = 4;
const STATUS_POLL_MS = 10_000;

type Phase =
  | { kind: "choosing" }
  | { kind: "confirming"; candidate: Candidate }
  | { kind: "sending"; candidate: Candidate; submissionId: string }
  | { kind: "error"; candidate: Candidate; submissionId: string; error: VoteErrorKind }
  | { kind: "thanks" };

export function BoothScreen({
  candidates,
  initialElection,
}: {
  candidates: Candidate[];
  initialElection: ElectionState;
}) {
  const router = useRouter();
  const [election, setElection] = useState(initialElection);
  const [phase, setPhase] = useState<Phase>({ kind: "choosing" });
  // Synchronous lock: blocks a second click before React re-renders.
  const sendingRef = useRef(false);

  // Keep the election status fresh: Realtime first, polling as a fallback.
  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase.from("election").select("status, test_mode").eq("id", 1).single();
      if (!cancelled && data) setElection(data as ElectionState);
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    void authorizeRealtime().then((client) => {
      if (cancelled) return;
      channel = client
        .channel("booth-election")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "election" },
          (payload: RealtimePostgresChangesPayload<ElectionState>) => {
            const row = payload.new as ElectionState;
            setElection({ status: row.status, test_mode: row.test_mode });
          },
        )
        .subscribe();
    });

    const timer = setInterval(refresh, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Candidates can change only in draft; reload them from the server when status changes.
  const lastStatus = useRef(election.status);
  useEffect(() => {
    if (lastStatus.current !== election.status) {
      lastStatus.current = election.status;
      router.refresh();
    }
  }, [election.status, router]);

  const send = useCallback(async (candidate: Candidate, submissionId: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setPhase({ kind: "sending", candidate, submissionId });
    try {
      const { error } = await getBrowserClient().rpc("cast_vote", {
        p_candidate_id: candidate.id,
        p_submission_id: submissionId,
      });
      if (error) {
        setPhase({ kind: "error", candidate, submissionId, error: classifyVoteError(error.message) });
      } else {
        setPhase({ kind: "thanks" });
      }
    } catch (error) {
      setPhase({ kind: "error", candidate, submissionId, error: classifyVoteError((error as Error).message) });
    } finally {
      sendingRef.current = false;
    }
  }, []);

  if (phase.kind === "thanks") {
    return <ThanksScreen onDone={() => setPhase({ kind: "choosing" })} />;
  }

  if (election.status !== "open" && phase.kind === "choosing") {
    return <ClosedScreen status={election.status} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {election.test_mode ? (
        <div
          role="status"
          className="booth-tape rounded-sticker border-[3px] border-ink px-4 py-2 text-center font-mono text-xs font-bold uppercase tracking-widest text-white shadow-sticker"
        >
          Mode uji coba · suara ini tidak dihitung
        </div>
      ) : null}

      <BoothHeader />

      <div className={`booth-grid grid flex-1 gap-6 ${gridColumns(candidates.length)}`}>
        {candidates.map((candidate, index) => (
          <CandidateCard
            key={candidate.id}
            index={index}
            candidate={candidate}
            disabled={phase.kind !== "choosing"}
            onSelect={(c) => setPhase({ kind: "confirming", candidate: c })}
          />
        ))}
      </div>

      <ConfirmModal
        phase={phase}
        onCancel={() => setPhase({ kind: "choosing" })}
        onConfirm={(candidate) => send(candidate, crypto.randomUUID())}
        onRetry={(candidate, submissionId) => send(candidate, submissionId)}
      />
    </div>
  );
}

const STEPS = ["Ketuk kartu paslon", "Periksa pilihanmu", "Tekan Ya, kirim"];

function BoothHeader() {
  return (
    <header className="flex animate-fade flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-3">
        <Sticker color="blue" rotate={-3}>
          Pemilu OSIS
        </Sticker>
        <span className="font-hand text-xl text-ink-soft">MAN 4 Jakarta</span>
      </div>
      <h1 className="font-display text-5xl tracking-wide [text-shadow:4px_4px_0_var(--color-yellow)] sm:text-6xl 2xl:text-7xl">
        PILIH PASLON
      </h1>
      <ol className="flex flex-wrap items-center justify-center gap-2">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2 rounded-full border-2 border-ink bg-surface py-1 pl-1 pr-3 font-mono text-[11px] font-bold uppercase tracking-widest"
          >
            <span className="grid size-5 place-items-center rounded-full bg-ink text-[10px] text-on-dark">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </header>
  );
}

// One row of cards fills the screen height; more rows keep a comfortable minimum and scroll.
function gridColumns(count: number): string {
  const rows = "auto-rows-[minmax(24rem,1fr)]";
  if (count <= 1) return `${rows} grid-cols-1 max-w-sm mx-auto w-full`;
  if (count === 2) return `${rows} grid-cols-2 max-w-3xl mx-auto w-full`;
  if (count === 3) return `${rows} grid-cols-1 sm:grid-cols-3 max-w-6xl mx-auto w-full`;
  if (count === 4) return `${rows} grid-cols-2 lg:grid-cols-4`;
  if (count <= 6) return `${rows} grid-cols-2 md:grid-cols-3`;
  return `${rows} grid-cols-2 md:grid-cols-4`;
}

function ConfirmModal({
  phase,
  onCancel,
  onConfirm,
  onRetry,
}: {
  phase: Phase;
  onCancel: () => void;
  onConfirm: (candidate: Candidate) => void;
  onRetry: (candidate: Candidate, submissionId: string) => void;
}) {
  const open = phase.kind === "confirming" || phase.kind === "sending" || phase.kind === "error";
  const candidate = open ? phase.candidate : null;
  const sending = phase.kind === "sending";

  return (
    <Modal open={open} onClose={sending || phase.kind === "error" ? () => {} : onCancel} labelledBy="confirm-title">
      {candidate ? (
        <div className="flex flex-col gap-6" style={accentStyle(candidate.nomor_urut)}>
          <div className="flex items-center gap-5">
            <div className="relative h-32 w-26 shrink-0 sm:h-36 sm:w-28">
              <div className="absolute inset-0 overflow-hidden rounded-card border-[3px] border-ink bg-[var(--accent)] shadow-[4px_4px_0_var(--color-ink)]">
                {candidate.foto_url ? (
                  <Image src={candidate.foto_url} alt="" fill unoptimized sizes="120px" className="object-cover object-top" />
                ) : null}
              </div>
              <span
                aria-hidden
                className="absolute -bottom-3 -right-3 grid size-11 rotate-6 place-items-center rounded-sticker border-[3px] border-ink bg-[var(--accent)] font-display text-2xl text-[var(--on-accent)]"
              >
                {candidate.nomor_urut}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Sticker color="yellow" rotate={-2}>
                Konfirmasi
              </Sticker>
              <h2 id="confirm-title" className="text-2xl font-bold leading-snug sm:text-3xl">
                Yakin memilih Paslon {candidate.nomor_urut}?
              </h2>
              <p className="font-hand text-xl leading-snug text-ink-soft">
                {candidate.nama_ketua} &amp; {candidate.nama_wakil}
              </p>
            </div>
          </div>

          {phase.kind === "error" ? (
            <>
              <div role="alert" className="rounded-sticker border-2 border-ink bg-danger px-4 py-3 font-semibold text-white">
                {VOTE_ERROR_TEXT[phase.error]}
              </div>
              {RETRYABLE[phase.error] ? (
                <Button size="xl" onClick={() => onRetry(phase.candidate, phase.submissionId)}>
                  Coba lagi
                </Button>
              ) : (
                <Button size="xl" variant="secondary" onClick={onCancel}>
                  Kembali
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Button size="xl" variant="secondary" disabled={sending} onClick={onCancel}>
                  Batal
                </Button>
                <Button size="xl" disabled={sending} onClick={() => onConfirm(candidate)}>
                  {sending ? "Mengirim..." : "Ya, kirim"}
                </Button>
              </div>
              {phase.kind === "confirming" ? <AutoCancel onTimeout={onCancel} /> : null}
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function AutoCancel({ onTimeout }: { onTimeout: () => void }) {
  const [left, setLeft] = useState(CONFIRM_TIMEOUT_SECONDS);
  const timeoutRef = useRef(onTimeout);
  useEffect(() => {
    timeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const remaining = CONFIRM_TIMEOUT_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        timeoutRef.current();
      } else {
        setLeft(remaining);
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="h-2 overflow-hidden rounded-full border-2 border-ink bg-paper">
        <div
          className="h-full origin-left bg-[var(--accent)]"
          style={{ animation: `drain ${CONFIRM_TIMEOUT_SECONDS}s linear both` }}
        />
      </div>
      <p className="text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
        Otomatis batal dalam {left} detik
      </p>
    </div>
  );
}

function ThanksScreen({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), THANKS_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden text-center">
      <Confetti />
      <div className="grid size-36 animate-stamp place-items-center rounded-full border-[6px] border-success bg-surface text-success shadow-card sm:size-44">
        <svg aria-hidden viewBox="0 0 24 24" className="size-20 sm:size-24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 12.5l5 5L19.5 7" />
        </svg>
      </div>
      <div className="flex animate-rise flex-col items-center gap-4 [animation-delay:250ms]">
        <Sticker color="mint" rotate={-3}>
          Suara tercatat
        </Sticker>
        <h1 className="font-display text-6xl [text-shadow:5px_5px_0_var(--color-mint)] sm:text-8xl">TERIMA KASIH</h1>
        <p className="font-hand text-2xl text-ink-soft">Suaramu sudah masuk. Silakan keluar dari bilik.</p>
      </div>
      <div className="mt-4 flex w-64 flex-col gap-2">
        <div aria-hidden className="h-2 overflow-hidden rounded-full border-2 border-ink bg-surface">
          <div className="h-full origin-left bg-ink" style={{ animation: `fill ${THANKS_SECONDS}s linear both` }} />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Layar kembali otomatis</p>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["bg-yellow", "bg-mint", "bg-pink", "bg-blue", "bg-green", "bg-red"];

// Deterministic pieces (no Math.random) so server and client render the same markup.
function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 28 }, (_, i) => {
        const left = (i * 37) % 100;
        const size = 8 + ((i * 7) % 10);
        const style = {
          left: `${left}%`,
          width: size,
          height: size * (i % 3 === 0 ? 2.2 : 1),
          animation: `confetti ${2.4 + (i % 5) * 0.35}s ${(i % 7) * 0.12}s cubic-bezier(0.2,0.6,0.4,1) both`,
          "--drift": `${((i * 53) % 160) - 80}px`,
          "--spin": `${360 + ((i * 97) % 540)}deg`,
        } as CSSProperties;
        return (
          <span
            key={i}
            className={`absolute top-0 rounded-[2px] border-2 border-ink ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
            style={style}
          />
        );
      })}
    </div>
  );
}

function ClosedScreen({ status }: { status: ElectionState["status"] }) {
  const closed = status === "closed";
  return (
    <div role="status" className="flex flex-1 items-center justify-center">
      <div className="flex w-full max-w-2xl animate-pop flex-col items-center gap-6 rounded-modal border-[3px] border-ink bg-surface px-8 py-12 text-center shadow-card-lift">
        <div
          className={`grid size-24 -rotate-6 place-items-center rounded-card border-[3px] border-ink shadow-[4px_4px_0_var(--color-ink)] ${closed ? "bg-pink text-white" : "bg-yellow"}`}
        >
          {closed ? <LockIcon /> : <ClockIcon />}
        </div>
        <Sticker color={closed ? "pink" : "yellow"} rotate={-2}>
          {closed ? "Selesai" : "Belum mulai"}
        </Sticker>
        <h1 className="font-display text-5xl sm:text-7xl">{closed ? "SUDAH DITUTUP" : "BELUM DIBUKA"}</h1>
        <p className="font-hand text-2xl text-ink-soft">
          {closed
            ? "Pemungutan suara sudah ditutup. Terima kasih."
            : "Pemungutan suara belum dibuka. Mohon tunggu petugas."}
        </p>
        {closed ? null : (
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            <span aria-hidden className="size-2 rounded-full bg-green [animation:blink_1.4s_ease-in-out_infinite]" />
            Layar terbuka sendiri saat voting dimulai
          </p>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
