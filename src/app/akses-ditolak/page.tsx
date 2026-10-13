import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";

export const metadata = { title: "Akses ditolak · Pemilu OSIS" };

export default function AccessDeniedPage() {
  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="manila flex max-w-xl animate-drop flex-col items-center gap-6 px-10 py-12 text-center shadow-card-lift">
          <span className="rubber-stamp animate-stamp px-4 py-1 text-2xl">
            403 · Dilarang masuk
          </span>
          <h1 className="font-display text-5xl font-black">AKSES DITOLAK</h1>
          <p className="font-type text-lg text-ink">
            Akun ini tidak punya izin membuka halaman tersebut.
          </p>
          <Link href="/" className={buttonClasses("secondary", "md")}>
            Ke halaman utama
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
