import { getSessionUser } from "@/lib/auth";
import { resultsToCsv } from "@/lib/export/csv";
import { resultsToPdf } from "@/lib/export/pdf";
import { getServerClient } from "@/lib/supabase/server";
import type { ListedVoter, Results } from "@/lib/types";

export async function GET(_request: Request, ctx: RouteContext<"/admin/export/[format]">) {
  const { format } = await ctx.params;
  if (format !== "csv" && format !== "pdf") return new Response("Format tidak dikenal", { status: 404 });

  const user = await getSessionUser();
  if (user?.role !== "admin") return new Response("Akses ditolak", { status: 403 });

  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc("get_results");
  if (error) return new Response("Gagal memuat hasil", { status: 500 });
  await supabase.rpc("log_export", { p_format: format });

  const results = data as Results;
  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const suffix = results.test_mode ? "-UJI-COBA" : results.status === "closed" ? "-AKHIR" : "-SEMENTARA";
  const filename = `hasil-pemilu-mpk-${stamp}${suffix}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (format === "csv") {
    const { data: voters, error: votersError } = await supabase.rpc("list_voters");
    if (votersError) return new Response("Gagal memuat daftar pemilih", { status: 500 });
    return new Response(resultsToCsv(results, voters as ListedVoter[], now), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const pdf = await resultsToPdf(results, now);
  return new Response(Buffer.from(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
