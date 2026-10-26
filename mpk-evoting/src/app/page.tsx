import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PaperClip } from "@/components/ui/PaperClip";

const ROLES = [
  {
    href: "/admin/login",
    cta: "Lanjut sebagai Admin",
    file: "Berkas A",
    title: "Admin",
    tag: "Panitia & pembina",
    body: "Pantau suara masuk secara live, buka dan tutup voting, kelola paslon dan daftar pemilih.",
    rot: "-2deg",
    icon: <ChartIcon />,
    // Most visitors are voters on a phone: on small screens the voter card comes first.
    order: "order-2 sm:order-1",
  },
  {
    href: "/pilih",
    cta: "Lanjut sebagai Pemilih",
    file: "Berkas B",
    title: "Pemilih",
    tag: "Lewat HP",
    body: "Pilih perwakilan, kelas, dan namamu, lalu pilih paslon. Satu orang satu suara.",
    rot: "1.6deg",
    icon: <BallotIcon />,
    order: "order-1 sm:order-2",
  },
];

export default function HomePage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-gutter py-6 sm:px-8 sm:py-10">
      <Backdrop />
      <Decorations />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 sm:gap-14">
        <Headline />

        <div className="fx-grid relative grid w-full max-w-4xl gap-7 sm:grid-cols-2 sm:gap-12">
          <svg
            aria-hidden
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 -top-16 hidden h-24 w-full sm:block"
          >
            <path
              d="M 250 76 Q 380 0 500 4 Q 620 0 750 76"
              fill="none"
              stroke="var(--color-pink)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              pathLength={1200}
              className="string-path"
            />
          </svg>
          {ROLES.map((role, index) => (
            <CaseFile key={role.href} index={index} {...role} />
          ))}
        </div>

        <p className="paper flex max-w-lg rotate-[-0.8deg] animate-fade items-center gap-3 px-4 py-2.5 text-left font-type text-xs text-ink [animation-delay:700ms] sm:px-5 sm:py-3 sm:text-sm">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-dark text-on-dark">
            <LockIcon />
          </span>
          Satu orang, satu suara. Pastikan kamu memilih namamu sendiri.
        </p>
      </div>
    </main>
  );
}

// Newspaper clipping with the election headline.
function Headline() {
  return (
    <header className="relative animate-drop">
      <span aria-hidden className="tape absolute -left-5 -top-3 z-10 h-6 w-20 -rotate-[20deg] sm:-left-8 sm:h-7 sm:w-24" />
      <span aria-hidden className="tape absolute -bottom-3 -right-5 z-10 h-6 w-20 -rotate-[20deg] sm:-right-8 sm:h-7 sm:w-24" />
      <div className="newsprint -rotate-1 px-4 pb-4 pt-3 text-center sm:px-14 sm:pb-5">
        <div className="flex items-center justify-between gap-8 border-b-2 border-ink pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-ink-soft sm:text-[11px]">
          <span>Edisi khusus</span>
          <span>MAN 4 Jakarta</span>
        </div>
        <p className="mt-2 font-type text-[11px] uppercase tracking-[0.2em] text-ink-soft sm:text-sm sm:tracking-[0.3em]">
          Pemilihan ketua &amp; wakil ketua MPK
        </p>
        <h1 className="whitespace-nowrap font-display text-[clamp(1.9rem,9.5vw,2.6rem)] font-black uppercase leading-none tracking-tight sm:text-7xl lg:text-8xl">KADERISASI 2026</h1>
        <p className="mx-auto mt-2 max-w-2xl border-t border-ink/40 pt-2 font-hand text-lg font-bold leading-tight text-pink sm:text-2xl">
          Integrity for Foundation, Wisdom for Direction: Leading Beyond Expectation
        </p>
      </div>
    </header>
  );
}

function CaseFile({
  href,
  cta,
  file,
  title,
  tag,
  body,
  rot,
  icon,
  order,
  index,
}: (typeof ROLES)[number] & { index: number }) {
  const style = {
    "--rot": rot,
    "--lift": "-10px",
    "--fx-inset": "2rem 0 0 0",
    "--fx-radius": "var(--radius-modal)",
    animationDelay: `${250 + index * 150}ms` } as CSSProperties;
  return (
    <Link href={href} style={style} className={`fx-card group relative block animate-drop ${order}`}>
      <div className="fx-body relative pt-7 sm:pt-8">
        <span aria-hidden className="manila absolute left-5 top-0 h-9 w-32 rounded-t-[6px] shadow-none sm:h-10 sm:w-40" />
        <span className="absolute left-8 top-1.5 font-type text-xs uppercase tracking-widest text-ink-soft sm:left-9 sm:top-2 sm:text-sm">
          {file}
        </span>
        <div className="manila relative flex flex-col overflow-hidden rounded-modal">
          <PaperClip className="absolute -top-4 right-8 h-14 w-5 rotate-6" />
          <div className="flex items-center gap-4 px-4 pb-2 pt-5 sm:gap-5 sm:px-6 sm:pb-4 sm:pt-7">
            <div className="paper relative grid size-16 shrink-0 -rotate-6 place-items-center p-1.5 sm:size-24 sm:p-2">
              <span aria-hidden className="fx-pin pin absolute -top-2 left-1/2 z-10 size-4" />
              <span className="fx-photo grid size-full place-items-center bg-mint/60 text-ink">{icon}</span>
            </div>
            <div className="flex flex-col items-start gap-2">
              <span className="fx-stamp rubber-stamp px-2 py-0.5 text-[10px] sm:text-[11px]">{tag}</span>
              <span className="font-display text-4xl font-black leading-none sm:text-5xl">{title}</span>
            </div>
          </div>
          <p className="px-4 pb-4 font-type text-sm leading-relaxed text-ink sm:px-6 sm:pb-6 sm:text-base">{body}</p>
          <span className="fx-cta flex items-center justify-between bg-surface-dark px-4 py-3 font-type text-sm uppercase tracking-[0.15em] text-on-dark sm:px-6 sm:py-4">
            {cta}
            <span aria-hidden className="fx-arrow text-lg">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Old photos, maps and newspapers on a desk, slowly drifting under a warm lamp.
// The lamp glow is static: animating a full-screen translucent layer stuttered on weak laptops.
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-frame">
      <div className="absolute inset-0 animate-fade bg-[url('/bg/papan-detektif.webp')] will-change-transform bg-cover bg-center [animation:fade_1.2s_ease-out_both,drift_40s_ease-in-out_infinite_alternate]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(43_29_18/0.15)_0%,rgb(43_29_18/0.55)_60%,rgb(20_12_6/0.9)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_220_160/0.12)_45%,transparent_60%)]" />
    </div>
  );
}

// Props scattered on the board; purely decorative.
function Decorations() {
  const items: { className: string; delay: string; node: ReactNode }[] = [
    {
      className: "left-[4%] top-[8%] w-36 -rotate-12",
      delay: "300ms",
      node: (
        <div className="paper relative p-2 pb-6">
          <span aria-hidden className="pin absolute -top-2 left-1/2 size-4 -translate-x-1/2 [--pin:var(--color-blue)]" />
          <div className="h-24 bg-[linear-gradient(135deg,#6b5541,#2a1d14)] opacity-80" />
          <span className="absolute inset-x-0 bottom-1 text-center font-hand text-lg font-bold">TKP?</span>
        </div>
      ),
    },
    {
      className: "bottom-[8%] left-[6%] w-44 rotate-3",
      delay: "600ms",
      node: <span className="rubber-stamp block -rotate-12 px-3 py-1 text-center text-lg">Top secret</span>,
    },
    {
      className: "bottom-[6%] right-[6%] w-28",
      delay: "750ms",
      node: <MagnifierProp />,
    },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {items.map((item, i) => (
        <div key={i} className={`absolute animate-pop ${item.className}`} style={{ animationDelay: item.delay }}>
          {item.node}
        </div>
      ))}
    </div>
  );
}

function MagnifierProp() {
  return (
    <svg viewBox="0 0 120 120" className="w-full will-change-transform drop-shadow-[3px_6px_6px_rgb(30_18_8/0.5)] [animation:swing_5s_ease-in-out_infinite]">
      <circle cx="48" cy="48" r="34" fill="rgb(220 235 240 / 0.35)" stroke="var(--color-brass)" strokeWidth="9" />
      <path d="M72 72l34 34" stroke="var(--color-surface-dark)" strokeWidth="14" strokeLinecap="round" />
      <path d="M30 34a22 22 0 0 1 16-12" stroke="white" strokeOpacity="0.7" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-9 sm:size-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V6M17 16v-8" />
    </svg>
  );
}

function BallotIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-9 sm:size-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
