"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAccountFailures, isLoginBlocked, rateLimitKeys, recordLoginFailure } from "@/lib/login-rate-limit";
import { HOME_FOR_ROLE, roleFromClaims, type AppRole } from "@/lib/roles";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

export type LoginState = { error: string | null };

const ROLE_LABEL: Record<AppRole, string> = { admin: "admin", bilik: "bilik" };

// Accepts "bilik1" or a full email address.
function toEmail(username: string): string {
  const value = username.trim().toLowerCase();
  if (value.includes("@")) return value;
  const domain = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-osis.local";
  return `${value}@${domain}`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expectedRole = formData.get("role") === "admin" ? "admin" : "bilik";
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username.trim() || !password) {
    return { error: "Nama akun dan kata sandi wajib diisi." };
  }

  const email = toEmail(username);
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip");
  const keys = rateLimitKeys(email, ip);

  try {
    if (await isLoginBlocked(keys)) {
      return { error: "Terlalu banyak percobaan gagal. Tunggu 15 menit lalu coba lagi." };
    }
  } catch (error) {
    // Usually a wrong or missing SUPABASE_SERVICE_ROLE_KEY on the host; visible in the Vercel logs.
    console.error(error);
    return { error: "Server sedang bermasalah. Coba lagi sebentar." };
  }

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    await recordLoginFailure(keys);
    return { error: "Nama akun atau kata sandi salah." };
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const role = roleFromClaims(claimsData?.claims);
  if (role !== expectedRole) {
    await supabase.auth.signOut({ scope: "local" });
    await recordLoginFailure(keys);
    return { error: `Akun ini bukan akun ${ROLE_LABEL[expectedRole]}.` };
  }

  await clearAccountFailures(keys);
  await getServiceClient()
    .from("audit_logs")
    .insert({ aktor: email, aksi: role === "admin" ? "Login admin" : "Login bilik" });
  redirect(HOME_FOR_ROLE[role]);
}

export async function logout(): Promise<void> {
  const supabase = await getServerClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.email) {
    await getServiceClient().from("audit_logs").insert({ aktor: String(data.claims.email), aksi: "Logout" });
  }
  // Local scope: the admin account is shared by several laptops at once, so logging out
  // on one must not end the sessions on the others.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
