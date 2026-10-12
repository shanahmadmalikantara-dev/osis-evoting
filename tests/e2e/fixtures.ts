import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

export const PASSWORD = "E2e-Test-Password-123";
export const DOMAIN = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-osis.local";

export const E2E_USERS = {
  admin: { username: "e2e-admin", role: "admin" },
  bilik: { username: "e2e-bilik", role: "bilik" },
  bilik2: { username: "e2e-bilik2", role: "bilik" },
  locked: { username: "e2e-locked", role: "bilik" },
} as const;

export function assertLocal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error("E2E tests only run against a local Supabase. NEXT_PUBLIC_SUPABASE_URL is not local.");
  }
}

export function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Direct DB access for test-only resets (local database only).
export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}
