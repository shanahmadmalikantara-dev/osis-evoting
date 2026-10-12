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
      <header className="flex flex-col gap-1">
        <p className="font-hand text-lg">pemilihan ketua &amp; wakil ketua osis</p>
        <h1 className="font-display text-4xl sm:text-5xl">DASHBOARD</h1>
      </header>
      <AdminDashboard initialResults={data as Results} />
    </>
  );
}
