import type { CSSProperties } from "react";

// One accent per ballot number, shared by the booth cards and the admin results.
const ACCENTS = [
  { accent: "var(--color-yellow)", onAccent: "var(--color-ink)" },
  { accent: "var(--color-mint)", onAccent: "var(--color-ink)" },
  { accent: "var(--color-pink)", onAccent: "#ffffff" },
  { accent: "var(--color-blue)", onAccent: "#ffffff" },
  { accent: "var(--color-green)", onAccent: "#ffffff" },
  { accent: "var(--color-red)", onAccent: "#ffffff" },
];

export function candidateAccent(nomorUrut: number) {
  return ACCENTS[(nomorUrut - 1) % ACCENTS.length];
}

// Sets --accent / --on-accent, which the fx-* classes and bg-[var(--accent)] utilities read.
export function accentStyle(nomorUrut: number): CSSProperties {
  const { accent, onAccent } = candidateAccent(nomorUrut);
  return { "--accent": accent, "--on-accent": onAccent } as CSSProperties;
}
