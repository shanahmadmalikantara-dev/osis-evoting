import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageShell } from "@/components/ui/PageShell";
import { requireRole } from "@/lib/auth";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  return (
    <PageShell wide>
      <AdminNav email={user.email} />
      <div className="mt-8 flex flex-1 flex-col gap-8">{children}</div>
    </PageShell>
  );
}
