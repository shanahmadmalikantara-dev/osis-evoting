import "server-only";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import type { Candidate, ElectionState, RosterVoter } from "@/lib/types";

// Phones that already voted keep showing the thank-you screen (one phone, one voter).
export const VOTED_COOKIE = "mpk_pemilih";

export type Ballot = {
  election: ElectionState;
  candidates: Candidate[];
  // Only sent while voting is open, so the roster is not public the rest of the time.
  roster: RosterVoter[];
  // True when this phone already voted in the current round (trial or real).
  alreadyVoted: boolean;
};

// The voter page has no login: it reads through the server with the service_role key.
export async function loadBallot(): Promise<Ballot> {
  const supabase = getServiceClient();
  const { data: election, error } = await supabase.from("election").select("status, test_mode").eq("id", 1).single();
  if (error || !election) throw new Error("Gagal memuat status pemilihan");

  const votedId = (await cookies()).get(VOTED_COOKIE)?.value;
  let alreadyVoted = false;
  if (votedId && /^[0-9a-f-]{36}$/i.test(votedId)) {
    const { data } = await supabase.rpc("voter_has_voted", { p_voter_id: votedId });
    alreadyVoted = data === true;
  }

  if (election.status !== "open" || alreadyVoted) {
    return { election: election as ElectionState, candidates: [], roster: [], alreadyVoted };
  }

  const [candidates, roster] = await Promise.all([
    supabase.from("candidates").select("id, nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi").order("nomor_urut"),
    supabase.rpc("voter_roster"),
  ]);
  if (candidates.error || roster.error) throw new Error("Gagal memuat data pemilihan");

  return {
    election: election as ElectionState,
    candidates: candidates.data as Candidate[],
    roster: roster.data as RosterVoter[],
    alreadyVoted,
  };
}
