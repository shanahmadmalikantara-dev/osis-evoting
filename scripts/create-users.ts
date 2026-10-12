// LOCAL ONLY. Creates the 3 admin and 5 booth accounts with strong random passwords
// and prints them ONCE. Existing accounts are left untouched (their password is not shown again).
//
// Usage: npm run create-users
import { randomInt } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

const ACCOUNTS = [
  ...[1, 2, 3].map((n) => ({ name: `admin${n}`, role: "admin" as const })),
  ...[1, 2, 3, 4, 5].map((n) => ({ name: `bilik${n}`, role: "bilik" as const })),
];

// No look-alike characters (0/O, 1/l/I) so passwords can be typed from paper.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 20): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export async function createUsers(): Promise<void> {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const domain = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-osis.local";

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existingEmails = new Set(existing.users.map((u) => u.email?.toLowerCase()));

  const created: { email: string; password: string; role: string }[] = [];
  const skipped: string[] = [];

  for (const account of ACCOUNTS) {
    const email = `${account.name}@${domain}`;
    if (existingEmails.has(email)) {
      skipped.push(email);
      continue;
    }
    const password = generatePassword();
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: account.role },
    });
    if (error) throw new Error(`Gagal membuat ${email}: ${error.message}`);
    created.push({ email, password, role: account.role });
  }

  if (created.length > 0) {
    console.log("\n================ SIMPAN SEKARANG — HANYA DITAMPILKAN SEKALI ================");
    for (const c of created) console.log(`${c.role.padEnd(6)} ${c.email.padEnd(32)} ${c.password}`);
    console.log("=============================================================================\n");
  }
  if (skipped.length > 0) {
    console.log(`Sudah ada sebelumnya (password tidak ditampilkan lagi): ${skipped.join(", ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createUsers().catch((error) => {
    console.error(`\n✗ ${(error as Error).message}\n`);
    process.exit(1);
  });
}
