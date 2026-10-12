import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Sticker } from "@/components/ui/Sticker";

export const metadata = { title: "Akses ditolak · Pemilu OSIS" };

export default function AccessDeniedPage() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <Sticker color="pink" rotate={-3}>403</Sticker>
        <h1 className="font-display text-5xl">AKSES DITOLAK</h1>
        <p className="font-hand text-xl text-ink-soft">Akun ini tidak punya izin membuka halaman tersebut.</p>
        <Link href="/" className={buttonClasses("secondary", "md")}>
          Ke halaman utama
        </Link>
      </div>
    </PageShell>
  );
}
