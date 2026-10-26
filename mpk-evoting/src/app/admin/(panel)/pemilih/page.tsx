import { VoterManager } from "@/components/admin/VoterManager";
import { PageHeading } from "@/components/ui/PageHeading";
import { getServerClient } from "@/lib/supabase/server";
import type { ElectionStatus, ListedVoter } from "@/lib/types";

export const metadata = { title: "Daftar Pemilih · Pemilu MPK" };

export default async function PemilihPage() {
  const supabase = await getServerClient();
  const [voters, election] = await Promise.all([
    supabase.rpc("list_voters"),
    supabase.from("election").select("status").eq("id", 1).single(),
  ]);
  if (voters.error || election.error) throw new Error("Gagal memuat daftar pemilih");

  return (
    <>
      <PageHeading kicker="Siapa saja yang boleh memilih" title="PEMILIH" />
      <VoterManager initialVoters={voters.data as ListedVoter[]} status={election.data.status as ElectionStatus} />
    </>
  );
}
