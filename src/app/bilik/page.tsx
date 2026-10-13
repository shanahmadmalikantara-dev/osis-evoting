import { BoothScreen } from "@/components/booth/BoothScreen";
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
    <main className="flex h-dvh flex-col overflow-y-auto px-gutter py-5 sm:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
        <BoothScreen
          candidates={candidatesResult.data as Candidate[]}
          initialElection={electionResult.data as ElectionState}
        />
      </div>
    </main>
  );
}
