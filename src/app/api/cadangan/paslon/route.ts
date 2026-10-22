import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

// Public, read-only list of candidates for the offline backup app (backup-app/), with photos
// inlined as data URLs so the app can store everything and vote with no internet at all.
// Candidate names, numbers, photos and vision-mission are public campaign material; no votes,
// accounts or election state are exposed here.

export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

type Row = {
  id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_url: string | null;
  visi_misi: string;
};

async function inlinePhoto(url: string | null, base: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(new URL(url, base), { cache: "no-store" });
    if (!response.ok) return null;
    const type = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
    if (!type.startsWith("image/")) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_PHOTO_BYTES) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { data, error } = await getServiceClient()
    .from("candidates")
    .select("id, nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi")
    .order("nomor_urut");
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengambil data paslon." }, { status: 500, headers: CORS });
  }

  const candidates = await Promise.all(
    (data as Row[]).map(async (c) => ({ ...c, foto_url: await inlinePhoto(c.foto_url, request.url) })),
  );
  return NextResponse.json({ candidates, generated_at: new Date().toISOString() }, { headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET" } });
}
