import type { ReactNode } from "react";

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "manila border-l-[6px] border-l-pink",
    error: "bg-danger text-white",
    success: "bg-success text-white",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-sticker border-2 border-ink px-4 py-3 font-type text-sm ${styles}`}>
      {children}
    </div>
  );
}
