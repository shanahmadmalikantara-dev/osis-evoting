import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { PageShell } from "@/components/ui/PageShell";
import { Sticker } from "@/components/ui/Sticker";
import type { AppRole } from "@/lib/roles";

export function LoginCard({ role }: { role: AppRole }) {
  const isAdmin = role === "admin";
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
        <Link
          href="/"
          className="group flex w-fit items-center gap-2 font-hand text-lg text-ink-soft transition-colors hover:text-ink"
        >
          <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
          kembali
        </Link>
        <div className="relative animate-pop overflow-hidden rounded-card border-[3px] border-ink bg-surface p-6 shadow-card-lift sm:p-8">
          <span aria-hidden className={`absolute inset-x-0 top-0 h-3 border-b-[3px] border-ink ${isAdmin ? "bg-yellow" : "bg-mint"}`} />
          <div className="mb-6 flex flex-col items-start gap-3">
            <Sticker color={isAdmin ? "yellow" : "mint"} rotate={-2}>
              {isAdmin ? "Panitia & pembina" : "Laptop bilik"}
            </Sticker>
            <h1 className="font-display text-4xl [text-shadow:3px_3px_0_var(--color-paper-line)]">{isAdmin ? "MASUK ADMIN" : "MASUK BILIK"}</h1>
            <p className="font-hand text-lg text-ink-soft">
              {isAdmin
                ? "Khusus pembina OSIS untuk memantau dan mengelola pemilihan."
                : "Dilakukan petugas sekali saja, sehari sebelum hari-H."}
            </p>
          </div>
          <LoginForm role={role} usernameHint={isAdmin ? "admin1" : "bilik1"} />
        </div>
      </div>
    </PageShell>
  );
}
