import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Sticker } from "@/components/ui/Sticker";

const ROLES = [
  {
    href: "/admin/login",
    cta: "Lanjut sebagai Admin",
    title: "ADMIN",
    tag: "Panitia & pembina",
    body: "Pantau suara masuk secara live, buka dan tutup voting, kelola paslon, ekspor hasil.",
    accent: "var(--color-yellow)",
    onAccent: "var(--color-ink)",
    icon: <ChartIcon />,
  },
  {
    href: "/bilik",
    cta: "Lanjut sebagai Penyuara",
    title: "PENYUARA",
    tag: "Laptop bilik",
    body: "Layar bilik suara untuk pemilih. Pilih paslon, konfirmasi, selesai.",
    accent: "var(--color-blue)",
    onAccent: "#ffffff",
    icon: <BallotIcon />,
  },
];

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-gutter py-10 sm:px-8">
      <Decorations />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12">
        <header className="flex animate-fade flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-4">
            <Sticker color="mint" rotate={-4}>
              Satu klik
            </Sticker>
            <Sticker color="yellow" rotate={3}>
              Satu suara
            </Sticker>
          </div>
          <p className="font-hand text-xl">pemilihan ketua &amp; wakil ketua</p>
          <h1 className="font-display text-6xl leading-none [text-shadow:5px_5px_0_var(--color-yellow)] sm:text-8xl">
            PEMILU OSIS
          </h1>
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest">
            <span aria-hidden className="size-2 rounded-full bg-blue" />
            MAN 4 Jakarta
          </p>
        </header>

        <div className="fx-grid grid w-full max-w-4xl gap-8 sm:grid-cols-2">
          {ROLES.map((role, index) => (
            <RoleCard key={role.href} index={index} {...role} />
          ))}
        </div>

        <p className="flex max-w-lg animate-fade items-center gap-3 rounded-full border-2 border-ink bg-surface px-5 py-2 text-left font-hand text-lg text-ink-soft shadow-sticker [animation-delay:500ms]">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-on-dark">
            <LockIcon />
          </span>
          Pilihanmu rahasia. Aplikasi ini tidak menyimpan nama atau identitas pemilih.
        </p>
      </div>
    </main>
  );
}

function RoleCard({
  href,
  cta,
  title,
  tag,
  body,
  accent,
  onAccent,
  icon,
  index,
}: (typeof ROLES)[number] & { index: number }) {
  const style = {
    "--accent": accent,
    "--on-accent": onAccent,
    "--lift": "-8px",
    animationDelay: `${150 + index * 120}ms`,
  } as CSSProperties;
  return (
    <Link
      href={href}
      style={style}
      className="fx-card flex animate-rise flex-col overflow-hidden rounded-card border-[3px] border-ink bg-surface shadow-card"
    >
      <div className="relative flex items-center gap-5 overflow-hidden border-b-[3px] border-ink bg-[var(--accent)] px-6 py-7 text-[var(--on-accent)]">
        <span className="fx-wiggle grid size-16 shrink-0 place-items-center rounded-card border-[3px] border-ink bg-surface text-ink shadow-[3px_3px_0_var(--color-ink)]">
          {icon}
        </span>
        <span className="flex flex-col items-start gap-2">
          <span className="rounded-sticker bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-on-dark">
            {tag}
          </span>
          <span className="font-display text-4xl leading-none">{title}</span>
        </span>
        <span aria-hidden className="fx-shine absolute inset-y-0 left-0 w-1/3 bg-white/35" />
      </div>
      <p className="flex-1 px-6 py-5 text-base leading-relaxed text-ink-soft">{body}</p>
      <span className="fx-cta flex items-center justify-between border-t-[3px] border-ink bg-ink px-6 py-4 font-mono text-sm font-bold uppercase tracking-widest text-on-dark">
        {cta}
        <span aria-hidden className="fx-arrow text-lg">
          →
        </span>
      </span>
    </Link>
  );
}

// Floating stickers in the background; purely decorative.
function Decorations() {
  const shapes: { className: string; style: CSSProperties; children?: ReactNode }[] = [
    { className: "left-[6%] top-[12%] size-14 rotate-12 bg-pink", style: { animationDelay: "200ms" } },
    { className: "right-[8%] top-[18%] size-10 -rotate-6 rounded-full bg-mint", style: { animationDelay: "350ms" } },
    { className: "bottom-[14%] left-[10%] size-9 rotate-45 bg-blue", style: { animationDelay: "500ms" } },
    { className: "bottom-[10%] right-[12%] size-16 -rotate-12 bg-yellow", style: { animationDelay: "650ms" } },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      {shapes.map((shape, i) => (
        <span
          key={i}
          style={shape.style}
          className={`absolute animate-pop rounded-sticker border-[3px] border-ink shadow-[3px_3px_0_var(--color-ink)] ${shape.className}`}
        />
      ))}
    </div>
  );
}

function ChartIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V6M17 16v-8" />
    </svg>
  );
}

function BallotIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 13V3h10v10" />
      <path d="M9.5 8l1.8 1.8 3.2-3.3" />
      <rect x="3" y="13" width="18" height="8" rx="1.5" />
      <path d="M8 16.5h8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
