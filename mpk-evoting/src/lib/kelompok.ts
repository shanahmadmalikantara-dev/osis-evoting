// The groups allowed to vote in the MPK election. Keys match the voters.kelompok check in the DB.
export const KELOMPOK = [
  { key: "pimpinan", label: "Pimpinan", hint: "Pimpinan madrasah" },
  // Teachers are not on the roster: they type their own name on the phone.
  { key: "guru", label: "Guru", hint: "Ketik namamu sendiri" },
  { key: "ketua_eskul", label: "Ketua Eskul", hint: "Ketua ekstrakurikuler" },
  { key: "perwakilan_kelas", label: "Perwakilan Kelas", hint: "Utusan tiap kelas" },
  { key: "osis_mpk_lama", label: "OSIS/MPK 2025/2026", hint: "Pengurus periode sekarang" },
  { key: "calon_osis_mpk", label: "Calon OSIS/MPK 2026/2027", hint: "Calon pengurus periode baru" },
] as const;

export type KelompokKey = (typeof KELOMPOK)[number]["key"];

// Groups whose members come from the pasted roster.
export type RosterKelompokKey = Exclude<KelompokKey, "guru">;
export const ROSTER_KELOMPOK = KELOMPOK.filter(
  (k): k is Extract<(typeof KELOMPOK)[number], { key: RosterKelompokKey }> => k.key !== "guru",
);

export function kelompokLabel(key: string): string {
  return KELOMPOK.find((k) => k.key === key)?.label ?? key;
}

// Accepts what people type in a spreadsheet ("Ketua eskul", "perwakilan", "OSIS 25/26", ...).
export function parseKelompok(text: string): RosterKelompokKey | null {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return null;
  const exact = ROSTER_KELOMPOK.find((k) => k.key === t || k.label.toLowerCase() === t);
  if (exact) return exact.key;
  if (t.includes("pimpinan")) return "pimpinan";
  if (t.includes("calon")) return "calon_osis_mpk";
  if (t.includes("eskul") || t.includes("ekskul") || t.includes("ekstra")) return "ketua_eskul";
  if (t.includes("perwakilan") || t.includes("kelas")) return "perwakilan_kelas";
  if (t.includes("osis") || t.includes("mpk")) return "osis_mpk_lama";
  return null;
}

// "X-2" before "X-10", and X before XI before XII.
export function compareKelas(a: string, b: string): number {
  return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
}
