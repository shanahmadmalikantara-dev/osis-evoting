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
    body: "Pantau suara masuk secara live, buka dan tutup voting, kelola paslon, ekspor hasil.",
    rot: "-2deg",
    icon: <ChartIcon />,
  },
  {
    href: "/bilik",
    cta: "Lanjut sebagai Penyuara",
    file: "Berkas B",
    title: "Penyuara",
    tag: "Laptop bilik",
    body: "Layar bilik suara untuk pemilih. Pilih paslon, konfirmasi, selesai.",
    rot: "1.6deg",
    icon: <BallotIcon />,
  },
];

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-gutter py-10 sm:px-8">
      <Decorations />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-14">
        <Headline />

        <div className="fx-grid relative grid w-full max-w-4xl gap-12 sm:grid-cols-2">
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

        <p className="paper flex max-w-lg rotate-[-0.8deg] animate-fade items-center gap-3 px-5 py-3 text-left font-type text-sm text-ink [animation-delay:700ms]">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-dark text-on-dark">
            <LockIcon />
          </span>
          Pilihanmu rahasia. Aplikasi ini tidak menyimpan nama atau identitas pemilih.
        </p>
      </div>
    </main>
  );
}

// Newspaper clipping with the election headline.
function Headline() {
  return (
    <header className="relative animate-drop">
      <span aria-hidden className="tape absolute -left-8 -top-3 z-10 h-7 w-24 -rotate-[20deg]" />
      <span aria-hidden className="tape absolute -bottom-3 -right-8 z-10 h-7 w-24 -rotate-[20deg]" />
      <div className="newsprint -rotate-1 px-8 pb-5 pt-3 text-center sm:px-14">
        <div className="flex items-center justify-between gap-8 border-b-2 border-ink pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-ink-soft sm:text-[11px]">
          <span>Edisi khusus</span>
          <span>MAN 4 Jakarta</span>
        </div>
        <p className="mt-2 font-type text-sm uppercase tracking-[0.3em] text-ink-soft">Pemilihan ketua &amp; wakil ketua</p>
        <h1 className="font-display text-6xl font-black uppercase leading-none tracking-tight sm:text-8xl">PEMILU OSIS</h1>
        <p className="mt-2 border-t border-ink/40 pt-2 font-hand text-2xl font-bold text-pink">
          Satu klik, satu suara. Kasus dibuka hari ini.
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
  index,
}: (typeof ROLES)[number] & { index: number }) {
  const style = { "--rot": rot, "--lift": "-10px", animationDelay: `${250 + index * 150}ms` } as CSSProperties;
  return (
    <Link href={href} style={style} className="fx-card group relative block animate-drop">
      <div className="fx-body relative pt-8">
        <span aria-hidden className="manila absolute left-5 top-0 h-10 w-40 rounded-t-[6px] shadow-none" />
        <span className="absolute left-9 top-2 font-type text-sm uppercase tracking-widest text-ink-soft">{file}</span>
        <div className="manila relative flex flex-col overflow-hidden rounded-modal">
          <PaperClip className="absolute -top-4 right-8 h-14 w-5 rotate-6" />
          <div className="flex items-center gap-5 px-6 pb-4 pt-7">
            <div className="paper relative grid size-24 shrink-0 -rotate-6 place-items-center p-2">
              <span aria-hidden className="fx-pin pin absolute -top-2 left-1/2 z-10 size-4" />
              <span className="fx-photo grid size-full place-items-center bg-mint/60 text-ink">{icon}</span>
            </div>
            <div className="flex flex-col items-start gap-2">
              <span className="fx-stamp rubber-stamp px-2 py-0.5 text-[11px]">{tag}</span>
              <span className="font-display text-5xl font-black leading-none">{title}</span>
            </div>
          </div>
          <p className="px-6 pb-6 font-type text-base leading-relaxed text-ink">{body}</p>
          <span className="fx-cta flex items-center justify-between bg-surface-dark px-6 py-4 font-type text-sm uppercase tracking-[0.15em] text-on-dark">
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
      className: "right-[5%] top-[10%] w-40 rotate-6",
      delay: "450ms",
      node: (
        <div className="paper-ruled px-4 py-3 font-hand text-xl font-bold leading-tight text-blue">
          Siapa ketua OSIS berikutnya??
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
    <svg viewBox="0 0 120 120" className="w-full drop-shadow-[3px_6px_6px_rgb(30_18_8/0.5)] [animation:swing_5s_ease-in-out_infinite]">
      <circle cx="48" cy="48" r="34" fill="rgb(220 235 240 / 0.35)" stroke="var(--color-brass)" strokeWidth="9" />
      <path d="M72 72l34 34" stroke="var(--color-surface-dark)" strokeWidth="14" strokeLinecap="round" />
      <path d="M30 34a22 22 0 0 1 16-12" stroke="white" strokeOpacity="0.7" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V6M17 16v-8" />
    </svg>
  );
}

function BallotIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
