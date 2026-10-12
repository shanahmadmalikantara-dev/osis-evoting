"use server";

import { revalidatePath } from "next/cache";
import { adminErrorText } from "@/lib/admin-errors";
import { requireRole } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const LIFECYCLE = ["start_test", "end_test", "open_voting", "close_voting"] as const;
export type LifecycleAction = (typeof LIFECYCLE)[number];

// Runs one election lifecycle step as the logged-in admin (the database re-checks the role).
export async function runLifecycle(action: LifecycleAction): Promise<ActionResult> {
  if (!LIFECYCLE.includes(action)) return { ok: false, error: "Aksi tidak dikenal." };
  await requireRole("admin");
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc(action);
  if (error) return { ok: false, error: adminErrorText(error.message) };
  revalidatePath("/admin", "layout");
  if (action === "end_test") {
    const deleted = (data as { deleted_test_votes?: number } | null)?.deleted_test_votes ?? 0;
    return { ok: true, message: `Uji coba selesai. ${deleted} suara uji dibersihkan.` };
  }
  return { ok: true };
}
