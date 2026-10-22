"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CandidateCard } from "@/components/booth/CandidateCard";
import {
  BoothHeader,
  ClosedScreen,
  ConfirmModal,
  RedString,
  ThanksScreen,
  gridColumns,
  type Phase,
} from "@/components/booth/BoothParts";
import { authorizeRealtime, getBrowserClient } from "@/lib/supabase/browser";
import { playVoteSound, primeVoteSound } from "@/lib/vote-sound";
import type { Candidate, ElectionState } from "@/lib/types";

const STATUS_POLL_MS = 10_000;
import { classifyVoteError } from "@/lib/vote-errors";

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
    // Still inside the click, so the browser lets us unlock audio for the chime.
    primeVoteSound();
    setPhase({ kind: "sending", candidate, submissionId });
    try {
      const { error } = await getBrowserClient().rpc("cast_vote", {
        p_candidate_id: candidate.id,
        p_submission_id: submissionId,
      });
      if (error) {
        setPhase({ kind: "error", candidate, submissionId, error: classifyVoteError(error.message) });
      } else {
        // Only after the vote is confirmed recorded, like the thank-you screen.
        playVoteSound();
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
