"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CandidateCard } from "@/components/booth/CandidateCard";
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
    <div className="flex flex-1 flex-col gap-8">
      {election.test_mode ? (
        <div role="status" className="rounded-sticker border-2 border-ink bg-pink px-4 py-2 text-center font-mono text-xs font-bold uppercase tracking-widest text-white">
          Mode uji coba · suara ini tidak dihitung
        </div>
      ) : null}

      <header className="flex flex-col items-center gap-2 text-center">
        <p className="font-hand text-xl">silakan pilih satu paslon</p>
        <h1 className="font-display text-4xl sm:text-5xl">PILIH PASLON</h1>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
          Ketuk kartu paslon pilihanmu
        </p>
      </header>

      <div className={`grid flex-1 auto-rows-fr gap-6 ${gridColumns(candidates.length)}`}>
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
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

function gridColumns(count: number): string {
  if (count <= 1) return "grid-cols-1 max-w-sm mx-auto w-full";
  if (count === 2) return "grid-cols-2 max-w-3xl mx-auto w-full";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  if (count === 4) return "grid-cols-2 lg:grid-cols-4";
  if (count <= 6) return "grid-cols-2 md:grid-cols-3";
  return "grid-cols-2 md:grid-cols-4";
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
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Sticker color="yellow" rotate={-2}>
              Konfirmasi
            </Sticker>
            <h2 id="confirm-title" className="text-2xl font-semibold leading-snug">
              Yakin memilih Paslon {candidate.nomor_urut}?
            </h2>
            <p className="font-hand text-xl text-ink-soft">
              {candidate.nama_ketua} &amp; {candidate.nama_wakil}
            </p>
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
    <p className="text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
      Otomatis batal dalam {left} detik
    </p>
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
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Sticker color="mint" rotate={-3}>
        Suara tercatat
      </Sticker>
      <h1 className="font-display text-6xl sm:text-8xl">TERIMA KASIH</h1>
      <p className="font-hand text-2xl text-ink-soft">Suaramu sudah masuk. Silakan keluar dari bilik.</p>
    </div>
  );
}

function ClosedScreen({ status }: { status: ElectionState["status"] }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Sticker color={status === "closed" ? "pink" : "yellow"} rotate={-2}>
        {status === "closed" ? "Selesai" : "Belum mulai"}
      </Sticker>
      <h1 className="font-display text-4xl sm:text-6xl">
        {status === "closed" ? "SUDAH DITUTUP" : "BELUM DIBUKA"}
      </h1>
      <p className="font-hand text-2xl text-ink-soft">
        {status === "closed"
          ? "Pemungutan suara sudah ditutup. Terima kasih."
          : "Pemungutan suara belum dibuka. Mohon tunggu petugas."}
      </p>
    </div>
  );
}
