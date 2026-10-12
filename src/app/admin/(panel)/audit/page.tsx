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
      <header className="flex flex-col gap-1">
        <p className="font-hand text-lg">catatan semua aksi admin, tidak bisa diubah atau dihapus</p>
        <h1 className="font-display text-4xl sm:text-5xl">AUDIT LOG</h1>
      </header>
      <div className="overflow-x-auto rounded-card border-2 border-ink bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-2 border-ink bg-yellow font-mono text-xs uppercase tracking-widest">
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
                <tr key={row.id} className="border-b border-paper-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums">{formatDateTime(row.waktu)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.aktor}</td>
                  <td className="px-4 py-2">{row.aksi}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data.length === LIMIT ? <p className="text-sm text-ink-soft">Menampilkan {LIMIT} catatan terbaru.</p> : null}
    </>
  );
}
