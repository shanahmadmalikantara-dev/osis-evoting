import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Sticker } from "@/components/ui/Sticker";

export default function HomePage() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-12 text-center">
        <div className="relative flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between gap-6">
            <Sticker color="mint" rotate={-4}>Satu klik</Sticker>
            <Sticker color="yellow" rotate={3}>Satu suara</Sticker>
          </div>
          <p className="font-hand text-lg">pemilihan ketua &amp; wakil ketua</p>
          <h1 className="border-2 border-red px-5 py-3 font-display text-5xl leading-none sm:text-7xl">
            PEMILU OSIS
          </h1>
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest">
            <span aria-hidden className="size-2 rounded-full bg-blue" />
            MAN 4 Jakarta
          </p>
        </div>

        <div className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
          <Link href="/admin/login" className={buttonClasses("secondary", "xl", "flex-col gap-2 shadow-card")}>
            <span aria-hidden className="text-3xl">★</span>
            Lanjut sebagai Admin
          </Link>
          <Link href="/bilik" className={buttonClasses("primary", "xl", "flex-col gap-2 shadow-card")}>
            <span aria-hidden className="text-3xl">✓</span>
            Lanjut sebagai Penyuara
          </Link>
        </div>

        <p className="max-w-md font-hand text-lg text-ink-soft">
          Pilihanmu rahasia. Aplikasi ini tidak menyimpan nama atau identitas pemilih.
        </p>
      </div>
    </PageShell>
  );
}
