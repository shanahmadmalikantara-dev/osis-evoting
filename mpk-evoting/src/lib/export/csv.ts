import { formatDateTime, percent } from "@/lib/format";
import { kelompokLabel } from "@/lib/kelompok";
import type { ListedVoter, Results } from "@/lib/types";
import { ELECTION_TITLE, statusLabel } from "./labels";

// Semicolon-separated with a UTF-8 BOM: opens correctly in Excel with Indonesian regional settings.
const SEP = ";";

function cell(value: string | number): string {
  // Names come from a pasted roster: stop Excel from running one as a formula.
  const text = typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (...values: (string | number)[]) => values.map(cell).join(SEP);

export function resultsToCsv(results: Results, voters: ListedVoter[], exportedAt: Date): string {
  const lines = [
    row(ELECTION_TITLE),
    row("Status", statusLabel(results)),
    row("Dibuka", formatDateTime(results.opened_at)),
    row("Ditutup", formatDateTime(results.closed_at)),
    row("Diekspor", formatDateTime(exportedAt.toISOString())),
    row("Total suara", results.total),
    "",
    row("Nomor urut", "Ketua", "Wakil", "Suara", "Persentase"),
    ...results.candidates.map((c) =>
      row(c.nomor_urut, c.nama_ketua, c.nama_wakil, c.votes, percent(c.votes, results.total)),
    ),
    "",
    row("Kelompok", "Sudah memilih", "Terdaftar"),
    ...results.groups.map((g) => row(g.label, g.voted, g.total)),
    "",
    row("Nama", "Kelas", "Kelompok", "Pilihan (no. paslon)", "Waktu memilih"),
    ...voters.map((v) =>
      row(v.nama, v.kelas, kelompokLabel(v.kelompok), v.nomor_urut ?? "belum memilih", formatDateTime(v.voted_at)),
    ),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
