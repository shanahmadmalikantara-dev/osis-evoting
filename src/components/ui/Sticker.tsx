import type { ReactNode } from "react";

const COLORS = {
  yellow: "bg-yellow",
  mint: "bg-mint",
  pink: "bg-pink text-white",
  blue: "bg-blue text-white",
  green: "bg-green text-white",
} as const;

export type StickerColor = keyof typeof COLORS;

// Small label tag in the style of the design reference ("MADE THINGS", "SWEAT THE DETAILS").
export function Sticker({
  color = "yellow",
  rotate = 0,
  children,
}: {
  color?: StickerColor;
  rotate?: number;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block w-fit rounded-sticker px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest shadow-sticker ${COLORS[color]}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
