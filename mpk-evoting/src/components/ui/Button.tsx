import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-surface-dark text-on-dark border-ink hover:bg-pink",
  secondary: "bg-surface text-ink border-ink hover:bg-manila",
  danger: "bg-danger text-white border-ink hover:brightness-110",
  ghost: "bg-transparent text-ink border-transparent hover:border-ink",
};

const SIZES: Record<Size, string> = {
  md: "px-4 py-2 text-xs",
  lg: "px-6 py-3 text-sm",
  xl: "px-8 py-6 text-base sm:text-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
};

export function buttonClasses(variant: Variant = "primary", size: Size = "lg", extra = "") {
  return [
    "inline-flex items-center justify-center gap-3 border-2 font-mono font-bold uppercase tracking-widest",
    "rounded-sticker shadow-sticker transition-[background-color,color,transform,box-shadow] duration-200",
    "hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-px active:shadow-none",
    "disabled:hover:translate-y-0 disabled:hover:shadow-sticker",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

export function Button({ variant = "primary", size = "lg", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} {...props}>
      {icon ? <span className="grid size-6 place-items-center rounded-full bg-pink text-white">{icon}</span> : null}
      {children}
    </button>
  );
}
