import { requireRole } from "@/lib/auth";

export const metadata = { title: "Dashboard Admin · Pemilu OSIS" };

export default async function AdminPage() {
  await requireRole("admin");
  return <main className="p-8 font-display text-3xl">ADMIN (fase 4)</main>;
}
