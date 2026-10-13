import { PageHeading } from "@/components/ui/PageHeading";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getServerClient } from "@/lib/supabase/server";
import type { Results } from "@/lib/types";

export const metadata = { title: "Dashboard Admin · Pemilu OSIS" };

export default async function AdminPage() {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc("get_results");
  if (error) throw new Error("Gagal memuat hasil");

  return (
    <>
      <PageHeading kicker="Pemilihan ketua & wakil ketua OSIS" title="DASHBOARD" />
      <AdminDashboard initialResults={data as Results} />
    </>
  );
}
