import type { ReactNode } from "react";

const COLORS = {
  yellow: "bg-manila",
  mint: "bg-mint",
  pink: "bg-pink text-white",
  blue: "bg-blue text-white",
  green: "bg-green text-white",
} as const;

export type StickerColor = keyof typeof COLORS;

// Small typewritten label, like a strip of label tape stuck on evidence.
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
      className={`inline-block w-fit rounded-sticker px-3 py-1 font-type text-[12px] uppercase tracking-[0.18em] shadow-sticker ${COLORS[color]}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
