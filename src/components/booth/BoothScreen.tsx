"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { CandidateCard } from "@/components/booth/CandidateCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PaperClip } from "@/components/ui/PaperClip";
import { accentStyle } from "@/lib/accent";
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
    <div className="flex flex-1 flex-col gap-6">
      {election.test_mode ? (
        <div
          role="status"
          className="booth-tape -mx-gutter flex justify-center py-1.5 shadow-card sm:-mx-8"
        >
          <span className="px-4 font-mono text-sm font-bold uppercase tracking-[0.3em] text-ink">
            Mode uji coba · suara ini tidak dihitung
          </span>
        </div>
      ) : null}

      <BoothHeader />

      <div className={`fx-grid relative grid flex-1 gap-x-8 gap-y-10 pt-3 ${gridColumns(candidates.length)}`}>
        <RedString count={candidates.length} />
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

const STEPS = ["Ketuk foto paslon", "Periksa berkasnya", "Tekan Ya, kirim"];

// Newspaper clipping taped to the board.
function BoothHeader() {
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <header className="relative mx-auto w-full max-w-4xl animate-drop">
      <span aria-hidden className="tape absolute -left-10 -top-3 z-10 h-7 w-24 -rotate-12" />
      <span aria-hidden className="tape absolute -right-10 -top-3 z-10 h-7 w-24 rotate-12" />
      <div className="newsprint -rotate-[0.6deg] px-6 pb-4 pt-3 text-center">
        <div className="flex items-center justify-between border-b-2 border-ink pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft sm:text-[11px]">
          <span>Edisi khusus</span>
          <span className="hidden sm:inline">Harian Pemilu OSIS · MAN 4 Jakarta</span>
          <span suppressHydrationWarning>{today}</span>
        </div>
        <div className="border-b border-ink/40 py-1">
          <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl 2xl:text-7xl">
            PILIH PASLON
          </h1>
        </div>
        <ol className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2 font-type text-sm text-ink">
              <span className="grid size-6 place-items-center rounded-full border-2 border-pink font-mono text-xs font-bold text-pink">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}

// Red string running from pin to pin across one row of polaroids (large screens only).
function RedString({ count }: { count: number }) {
  if (count < 2 || count > 4) return null;
  const points = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * 1000);
  const d = points
    .slice(1)
    .map((x, i) => {
      const prev = points[i];
      return `Q ${(prev + x) / 2} 60 ${x} 6`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 80"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 -top-0 z-0 hidden h-20 w-full lg:block"
    >
      <path
        d={`M ${points[0]} 6 ${d}`}
        fill="none"
        stroke="var(--color-pink)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        className="string-path drop-shadow-[1px_2px_1px_rgb(30_18_8/0.5)]"
        pathLength={1200}
      />
    </svg>
  );
}

function gridColumns(count: number): string {
  const rows = "auto-rows-[minmax(25rem,1fr)]";
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
          <span className="absolute left-9 top-[-1.35rem] font-type text-xs uppercase tracking-widest text-ink-soft">
            Berkas paslon no. {candidate.nomor_urut}
          </span>
          <div className="flex items-center gap-6">
            <div className="paper relative w-28 shrink-0 -rotate-3 p-1.5 pb-5 sm:w-32">
              <span aria-hidden className="pin absolute -top-2 left-1/2 z-10 size-4 -translate-x-1/2" />
              <div className="relative aspect-[4/5] overflow-hidden bg-[var(--accent)]">
                {candidate.foto_url ? (
                  <Image src={candidate.foto_url} alt="" fill unoptimized sizes="130px" className="object-cover object-top" />
                ) : null}
              </div>
              <span className="absolute inset-x-0 bottom-0.5 text-center font-hand text-lg font-bold leading-none text-pink">
                No. {candidate.nomor_urut}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="rubber-stamp w-fit -rotate-3 px-2 py-0.5 text-xs">Konfirmasi</span>
              <h2 id="confirm-title" className="font-display text-3xl font-black leading-tight sm:text-4xl">
                Yakin memilih Paslon {candidate.nomor_urut}?
              </h2>
              <p className="font-type text-base leading-snug text-ink">
                {candidate.nama_ketua} &amp; {candidate.nama_wakil}
              </p>
            </div>
          </div>

          {phase.kind === "error" ? (
            <>
              <div role="alert" className="rounded-sticker border-2 border-ink bg-danger px-4 py-3 font-type text-white shadow-card">
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
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-ink/15">
        <div
          className="h-full origin-left rounded-full bg-pink"
          style={{ animation: `drain ${CONFIRM_TIMEOUT_SECONDS}s linear both` }}
        />
      </div>
      <p className="text-center font-type text-xs uppercase tracking-widest text-ink-soft">
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
    <div role="status" className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      <Confetti />
      <div className="paper-ruled relative w-full max-w-3xl animate-pop px-8 pb-10 pt-12 text-center sm:px-14">
        <span aria-hidden className="pin absolute -top-3 left-1/2 size-7 -translate-x-1/2" />
        <span
          aria-hidden
          className="rubber-stamp absolute -right-4 -top-6 grid size-36 animate-stamp place-items-center rounded-full bg-surface/60 text-center text-sm leading-tight [--stamp:var(--color-success)] sm:-right-10 sm:size-44"
        >
          <span className="flex flex-col items-center gap-1">
            <span>Suara</span>
            <CheckIcon />
            <span>Tercatat</span>
          </span>
        </span>
        <p className="font-hand text-3xl font-bold text-pink">Kasus ditutup, detektif!</p>
        <h1 className="mt-2 font-display text-6xl font-black leading-none sm:text-8xl">TERIMA KASIH</h1>
        <p className="mt-5 font-type text-xl text-ink">Suaramu sudah masuk. Silakan keluar dari bilik.</p>
        <div className="mx-auto mt-8 flex w-64 flex-col gap-2">
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-ink/15">
            <div className="h-full origin-left rounded-full bg-ink" style={{ animation: `fill ${THANKS_SECONDS}s linear both` }} />
          </div>
          <p className="font-type text-xs uppercase tracking-widest text-ink-soft">Layar kembali otomatis</p>
        </div>
      </div>
    </div>
  );
}

// Falling scraps of paper and evidence tags (deterministic: same markup on server and client).
const CONFETTI_COLORS = ["bg-surface", "bg-manila", "bg-pink", "bg-paper", "bg-surface", "bg-mint"];

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 26 }, (_, i) => {
        const size = 10 + ((i * 7) % 12);
        const style = {
          left: `${(i * 37) % 100}%`,
          width: size,
          height: size * (i % 3 === 0 ? 1.4 : 0.8),
          animation: `confetti ${2.6 + (i % 5) * 0.35}s ${(i % 7) * 0.12}s cubic-bezier(0.2,0.6,0.4,1) both`,
          "--drift": `${((i * 53) % 160) - 80}px`,
          "--spin": `${360 + ((i * 97) % 540)}deg`,
        } as CSSProperties;
        return (
          <span
            key={i}
            className={`absolute top-0 shadow-sticker ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
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
    <div role="status" className="flex flex-1 items-center justify-center py-8">
      <div className="relative w-full max-w-2xl animate-drop pt-8">
        <span aria-hidden className="manila absolute left-8 top-0 h-10 w-52 rounded-t-[6px] shadow-none" />
        <span className="absolute left-12 top-2 font-type text-sm uppercase tracking-widest text-ink-soft">
          Berkas no. 001 · OSIS
        </span>
        <div className="manila relative flex flex-col items-center gap-5 rounded-modal px-8 py-14 text-center shadow-card-lift">
          <PaperClip />
          <span
            className={`rubber-stamp animate-stamp px-5 py-2 text-xl ${closed ? "[--stamp:var(--color-blue)]" : ""}`}
          >
            {closed ? "Kasus ditutup" : "Rahasia · belum dibuka"}
          </span>
          <h1 className="font-display text-5xl font-black leading-none sm:text-7xl">
            {closed ? "SUDAH DITUTUP" : "BELUM DIBUKA"}
          </h1>
          <p className="font-type text-xl text-ink">
            {closed
              ? "Pemungutan suara sudah ditutup. Terima kasih."
              : "Pemungutan suara belum dibuka. Mohon tunggu petugas."}
          </p>
          {closed ? null : (
            <p className="flex items-center gap-2 font-hand text-2xl font-bold text-ink-soft">
              <span aria-hidden className="size-2.5 rounded-full bg-pink [animation:blink_1.4s_ease-in-out_infinite]" />
              Layar terbuka sendiri saat voting dimulai
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-12 sm:size-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}
