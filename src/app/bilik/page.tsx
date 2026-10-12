import { requireRole } from "@/lib/auth";

export const metadata = { title: "Bilik Suara · Pemilu OSIS" };

export default async function BilikPage() {
  await requireRole("bilik");
  return <main className="p-8 font-display text-3xl">BILIK (fase 3)</main>;
}
