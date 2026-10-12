import { CandidateManager } from "@/components/admin/CandidateManager";
import { getServerClient } from "@/lib/supabase/server";
import type { Candidate, ElectionStatus } from "@/lib/types";

export const metadata = { title: "Kelola Paslon · Pemilu OSIS" };

export default async function CandidatesPage() {
  const supabase = await getServerClient();
  const [candidates, election] = await Promise.all([
    supabase.from("candidates").select("id, nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi").order("nomor_urut"),
    supabase.from("election").select("status").eq("id", 1).single(),
  ]);
  if (candidates.error || election.error) throw new Error("Gagal memuat paslon");

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="font-hand text-lg">nama, foto, dan visi-misi</p>
        <h1 className="font-display text-4xl sm:text-5xl">KELOLA PASLON</h1>
      </header>
      <CandidateManager
        candidates={candidates.data as Candidate[]}
        editable={(election.data.status as ElectionStatus) === "draft"}
      />
    </>
  );
}
