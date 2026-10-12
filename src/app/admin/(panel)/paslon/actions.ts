"use server";

import { revalidatePath } from "next/cache";
import { adminErrorText } from "@/lib/admin-errors";
import { requireRole } from "@/lib/auth";
import { PHOTO_BUCKET, isAllowedPhotoUrl, storagePathFromUrl } from "@/lib/photos";
import { getServerClient } from "@/lib/supabase/server";

export type CandidateInput = {
  id?: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  visi_misi: string;
  foto_url: string | null;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

function validate(input: CandidateInput): string | null {
  if (!Number.isInteger(input.nomor_urut) || input.nomor_urut < 1 || input.nomor_urut > 99) {
    return "Nomor urut harus angka 1 sampai 99.";
  }
  if (!input.nama_ketua.trim() || !input.nama_wakil.trim()) return "Nama ketua dan wakil wajib diisi.";
  if (input.nama_ketua.length > 80 || input.nama_wakil.length > 80) return "Nama terlalu panjang (maks 80 huruf).";
  if (input.visi_misi.length > 3000) return "Visi-misi terlalu panjang (maks 3000 huruf).";
  if (input.foto_url && !isAllowedPhotoUrl(input.foto_url)) return "Alamat foto tidak valid.";
  return null;
}

function dbErrorText(message: string): string {
  if (message.includes("candidates_nomor_urut_key") || message.includes("duplicate key")) {
    return "Nomor urut itu sudah dipakai paslon lain.";
  }
  if (message.includes("foreign key")) return "Paslon ini sudah punya suara, jadi tidak bisa dihapus.";
  return adminErrorText(message);
}

export async function saveCandidate(input: CandidateInput): Promise<SaveResult> {
  await requireRole("admin");
  const clean: CandidateInput = {
    ...input,
    nama_ketua: input.nama_ketua.trim(),
    nama_wakil: input.nama_wakil.trim(),
    visi_misi: input.visi_misi.trim(),
  };
  const invalid = validate(clean);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await getServerClient();
  const row = {
    nomor_urut: clean.nomor_urut,
    nama_ketua: clean.nama_ketua,
    nama_wakil: clean.nama_wakil,
    visi_misi: clean.visi_misi,
    foto_url: clean.foto_url,
  };

  let oldPhoto: string | null = null;
  if (clean.id) {
    const { data: existing } = await supabase.from("candidates").select("foto_url").eq("id", clean.id).single();
    oldPhoto = existing?.foto_url ?? null;
    const { error } = await supabase.from("candidates").update(row).eq("id", clean.id).select("id").single();
    if (error) return { ok: false, error: dbErrorText(error.message) };
  } else {
    const { error } = await supabase.from("candidates").insert(row);
    if (error) return { ok: false, error: dbErrorText(error.message) };
  }

  // Remove the replaced photo from storage (best effort).
  const oldPath = storagePathFromUrl(oldPhoto);
  if (oldPath && oldPhoto !== clean.foto_url) {
    await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/bilik");
  return { ok: true };
}

export async function deleteCandidate(id: string): Promise<SaveResult> {
  await requireRole("admin");
  const supabase = await getServerClient();
  const { data: existing } = await supabase.from("candidates").select("foto_url").eq("id", id).single();
  const { error, count } = await supabase.from("candidates").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: dbErrorText(error.message) };
  if (count === 0) return { ok: false, error: "Paslon tidak ditemukan." };

  const path = storagePathFromUrl(existing?.foto_url);
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);

  revalidatePath("/admin", "layout");
  revalidatePath("/bilik");
  return { ok: true };
}
