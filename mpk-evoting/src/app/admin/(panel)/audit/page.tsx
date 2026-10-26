import { PageHeading } from "@/components/ui/PageHeading";
import { formatDateTime } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Audit Log · Pemilu OSIS" };

const LIMIT = 500;

export default async function AuditPage() {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, aktor, aksi, waktu")
    .order("id", { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error("Gagal memuat audit log");

  return (
    <>
      <PageHeading kicker="Catatan semua aksi admin, tidak bisa diubah atau dihapus" title="AUDIT LOG" />
      <div className="paper-ruled relative animate-rise overflow-x-auto pl-8">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-2 border-ink font-type text-xs uppercase tracking-widest text-pink">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Aktor</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-soft">
                  Belum ada catatan.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-b border-paper-line font-type transition-colors last:border-0 hover:bg-manila/50">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums">{formatDateTime(row.waktu)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.aktor}</td>
                  <td className="px-4 py-2">{row.aksi}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data.length === LIMIT ? <p className="font-type text-sm text-on-dark">Menampilkan {LIMIT} catatan terbaru.</p> : null}
    </>
  );
}
