import type { ReactNode } from "react";

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "bg-mint",
    error: "bg-danger text-white",
    success: "bg-success text-white",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-sticker border-2 border-ink px-4 py-3 text-sm font-semibold ${styles}`}>
      {children}
    </div>
  );
}
