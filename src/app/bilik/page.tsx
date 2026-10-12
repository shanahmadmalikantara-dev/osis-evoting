import { BoothScreen } from "@/components/booth/BoothScreen";
import { PageShell } from "@/components/ui/PageShell";
import { requireRole } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import type { Candidate, ElectionState } from "@/lib/types";

export const metadata = { title: "Bilik Suara · Pemilu OSIS" };

export default async function BilikPage() {
  await requireRole("bilik");
  const supabase = await getServerClient();

  const [candidatesResult, electionResult] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi")
      .order("nomor_urut"),
    supabase.from("election").select("status, test_mode").eq("id", 1).single(),
  ]);

  if (candidatesResult.error || electionResult.error) {
    throw new Error("Gagal memuat data bilik");
  }

  return (
    <PageShell wide>
      <BoothScreen
        candidates={candidatesResult.data as Candidate[]}
        initialElection={electionResult.data as ElectionState}
      />
    </PageShell>
  );
}
