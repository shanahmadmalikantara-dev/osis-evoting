import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { PageShell } from "@/components/ui/PageShell";
import { PaperClip } from "@/components/ui/PaperClip";
import type { AppRole } from "@/lib/roles";

// Login styled as an access pass clipped to a case folder.
export function LoginCard({ role }: { role: AppRole }) {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
        <Link
          href="/"
          className="group flex w-fit items-center gap-2 font-type text-base text-on-dark/90 transition-colors hover:text-on-dark"
        >
          <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
          kembali
        </Link>
        <div className="relative animate-drop pt-8">
          <span aria-hidden className="manila absolute left-6 top-0 h-10 w-48 rounded-t-[6px] shadow-none" />
          <span className="absolute left-10 top-2 font-type text-sm uppercase tracking-widest text-ink-soft">
            Kartu akses · {role}
          </span>
          <div className="manila relative rounded-modal p-6 shadow-card-lift sm:p-8">
            <PaperClip />
            <div className="mb-6 flex flex-col items-start gap-3">
              <span className="rubber-stamp -rotate-3 px-2 py-0.5 text-xs">
                Panitia &amp; pembina
              </span>
              <h1 className="font-display text-5xl font-black leading-none">Masuk Admin</h1>
              <p className="font-hand text-2xl font-bold leading-tight text-ink-soft">
                Khusus panitia untuk memantau dan mengelola pemilihan MPK.
              </p>
            </div>
            <LoginForm role={role} usernameHint="admin" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
