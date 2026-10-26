"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/admin/(panel)/actions";
import { adminErrorText } from "@/lib/admin-errors";
import { requireRole } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export type RosterRow = { nama: string; kelas: string; kelompok: string };

// Each step runs as the logged-in admin; the database re-checks the role and the rules.
async function run(fn: string, args?: Record<string, unknown>) {
  await requireRole("admin");
  const supabase = await getServerClient();
  const result = await supabase.rpc(fn, args);
  revalidatePath("/admin", "layout");
  return result;
}

export async function importVoters(rows: RosterRow[]): Promise<ActionResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Belum ada baris yang bisa dibaca." };
  if (rows.length > 3000) return { ok: false, error: "Maksimal 3000 baris sekali tempel." };
  const { data, error } = await run("import_voters", { p_rows: rows });
  if (error) return { ok: false, error: adminErrorText(error.message) };
  const { inserted, skipped } = data as { inserted: number; skipped: { nama: string; kelas: string }[] };
  const skippedText =
    skipped.length > 0
      ? ` ${skipped.length} dilewati karena sudah ada: ${skipped
          .slice(0, 5)
          .map((s) => `${s.nama} (${s.kelas})`)
          .join(", ")}${skipped.length > 5 ? ", ..." : ""}.`
      : "";
  return { ok: true, message: `${inserted} nama ditambahkan.${skippedText}` };
}

export async function deleteVoter(voterId: string): Promise<ActionResult> {
  const { error } = await run("delete_voter", { p_voter_id: voterId });
  return error ? { ok: false, error: adminErrorText(error.message) } : { ok: true, message: "Nama dihapus dari daftar." };
}

export async function cancelVote(voterId: string): Promise<ActionResult> {
  const { error } = await run("cancel_vote", { p_voter_id: voterId });
  return error
    ? { ok: false, error: adminErrorText(error.message) }
    : { ok: true, message: "Suara dibatalkan. Orang ini bisa memilih lagi." };
}

export async function clearVoters(): Promise<ActionResult> {
  const { data, error } = await run("clear_voters");
  if (error) return { ok: false, error: adminErrorText(error.message) };
  return { ok: true, message: `Daftar dikosongkan (${(data as { deleted: number }).deleted} nama dihapus).` };
}
