import { useCallback, useRef, useState } from "react";
import {
  BoothHeader,
  ClosedScreen,
  ConfirmModal,
  RedString,
  ThanksScreen,
  gridColumns,
  type Phase,
} from "@/components/booth/BoothParts";
import { CandidateCard } from "@/components/booth/CandidateCard";
import type { Candidate } from "@/lib/types";
import { playVoteSound, primeVoteSound } from "@/lib/vote-sound";
import { api, type PublicState } from "./store";

// The voting screen: same cards, confirmation, chime and thank-you screen as the website,
// but each vote is written to this laptop's disk.
export function Booth({ state, onOfficer }: { state: PublicState; onOfficer: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "choosing" });
  const sendingRef = useRef(false);
  const { candidates } = state;

  const send = useCallback(async (candidate: Candidate, submissionId: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    primeVoteSound();
    setPhase({ kind: "sending", candidate, submissionId });
    try {
      await api.castVote(submissionId, candidate.id);
      playVoteSound();
      setPhase({ kind: "thanks" });
    } catch {
      setPhase({ kind: "error", candidate, submissionId, error: "unknown" });
    } finally {
      sendingRef.current = false;
    }
  }, []);

  let body;
  if (phase.kind === "thanks") {
    body = <ThanksScreen onDone={() => setPhase({ kind: "choosing" })} />;
  } else if (state.status !== "open" && phase.kind === "choosing") {
    body = (
      <ClosedScreen
        status={state.status === "closed" ? "closed" : "draft"}
        waitingText="Voting cadangan belum dibuka. Mohon tunggu petugas."
        waitingHint="Petugas membuka voting lewat tombol Petugas"
      />
    );
  } else {
    body = (
      <div className="flex flex-1 flex-col gap-6">
        <BoothHeader edition={`Bilik cadangan ${state.bilik} · tanpa internet`} />
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

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div role="note" className="booth-tape -mx-gutter -mt-5 flex justify-center py-1.5 shadow-card sm:-mx-8">
        <span className="px-4 font-mono text-sm font-bold uppercase tracking-[0.3em] text-ink">
          Bilik cadangan {state.bilik} · suara disimpan di laptop ini
        </span>
      </div>
      {body}
      <button
        type="button"
        onClick={onOfficer}
        className="fixed bottom-3 right-3 z-20 rounded-full bg-surface-dark/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-on-dark/80 transition-colors hover:bg-surface-dark"
      >
        Petugas
      </button>
    </div>
  );
}
