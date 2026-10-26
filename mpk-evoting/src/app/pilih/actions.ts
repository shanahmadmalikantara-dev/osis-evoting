"use server";

import { cookies } from "next/headers";
import { loadBallot, VOTED_COOKIE, type Ballot } from "@/lib/ballot";
import { getServiceClient } from "@/lib/supabase/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function refreshBallot(): Promise<Ballot> {
  return loadBallot();
}

export type VoteResult = { ok: true } | { ok: false; error: string };

// submissionId is generated on the phone per "Ya, kirim" tap, so a retry never counts twice.
export async function submitVote(voterId: string, candidateId: string, submissionId: string): Promise<VoteResult> {
  if (![voterId, candidateId, submissionId].every((v) => typeof v === "string" && UUID.test(v))) {
    return { ok: false, error: "invalid_input" };
  }

  const { error } = await getServiceClient().rpc("cast_vote_voter", {
    p_voter_id: voterId,
    p_candidate_id: candidateId,
    p_submission_id: submissionId,
  });
  if (error) return { ok: false, error: error.message };

  (await cookies()).set(VOTED_COOKIE, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}
