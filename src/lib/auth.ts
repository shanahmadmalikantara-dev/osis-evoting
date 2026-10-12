import "server-only";
import { redirect } from "next/navigation";
import { LOGIN_FOR_ROLE, roleFromClaims, type AppRole } from "@/lib/roles";
import { getServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string; role: AppRole };

// Verifies the JWT and returns the user, or null when not logged in / no role.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const role = roleFromClaims(data.claims);
  if (!role) return null;
  return { id: data.claims.sub, email: String(data.claims.email ?? ""), role };
}

// Server-side guard for pages and actions (the proxy also checks, this is the second layer).
export async function requireRole(role: AppRole): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_FOR_ROLE[role]);
  if (user.role !== role) redirect("/akses-ditolak");
  return user;
}
