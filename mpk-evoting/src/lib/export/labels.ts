import type { Results } from "@/lib/types";

export const ELECTION_TITLE = "Pemilihan Ketua & Wakil Ketua MPK MAN 4 Jakarta";

export function statusLabel(results: Pick<Results, "status" | "test_mode">): string {
  if (results.status === "open" && results.test_mode) return "UJI COBA (tidak resmi)";
  if (results.status === "open") return "Sedang berlangsung (hasil sementara)";
  if (results.status === "closed") return "Ditutup (hasil akhir)";
  return "Draft (belum dibuka)";
}
