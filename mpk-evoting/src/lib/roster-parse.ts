import { parseKelompok, type RosterKelompokKey } from "@/lib/kelompok";

export type ParsedRow = { nama: string; kelas: string; kelompok: RosterKelompokKey };
export type ParseResult = { rows: ParsedRow[]; problems: string[] };

// Reads a roster pasted from Excel / Google Sheets (tab separated) or typed as CSV.
// Columns: nama, kelas, kelompok. Without a kelompok column, `fallback` is used.
export function parseRoster(text: string, fallback: RosterKelompokKey | null): ParseResult {
  const rows: ParsedRow[] = [];
  const problems: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, "").replace(/\s+/g, " "));
    const [nama = "", kelas = "", kelompokText = ""] = cells;

    // Header row copied along with the data.
    if (index === 0 && /^nama/i.test(nama) && /kelas/i.test(kelas)) return;

    const lineNo = index + 1;
    if (!nama || !kelas) {
      problems.push(`Baris ${lineNo}: nama atau kelas kosong.`);
      return;
    }
    if (nama.length > 120 || kelas.length > 60) {
      problems.push(`Baris ${lineNo}: nama atau kelas terlalu panjang.`);
      return;
    }
    const kelompok = kelompokText ? parseKelompok(kelompokText) : fallback;
    if (!kelompok) {
      problems.push(
        kelompokText
          ? `Baris ${lineNo}: perwakilan "${kelompokText}" tidak dikenal.`
          : `Baris ${lineNo}: perwakilan kosong. Isi kolom ketiga atau pilih perwakilan di atas.`,
      );
      return;
    }
    rows.push({ nama, kelas, kelompok });
  });

  return { rows, problems };
}
