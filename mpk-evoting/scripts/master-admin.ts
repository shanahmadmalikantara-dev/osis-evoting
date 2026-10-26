// LOCAL ONLY. Switches the project to a single shared admin account ("admin"):
// 1) gives "admin" a brand-new random password (creating the account if needed),
// 2) deletes every other admin-role account (e.g. admin1..admin3).
// Booth accounts and votes are not touched. The new password is printed ONCE.
//
// Usage: npm run master-admin
import { createClient } from "@supabase/supabase-js";
import { generatePassword } from "./create-users";
import { requireEnv, supabaseUrlFromEnv } from "./lib/env";

export const MASTER_ADMIN = "admin";

async function main() {
  const supabase = createClient(supabaseUrlFromEnv(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const domain = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-osis.local";
  const masterEmail = `${MASTER_ADMIN}@${domain}`;

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const password = generatePassword();
  const master = data.users.find((u) => u.email?.toLowerCase() === masterEmail);
  if (master) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(master.id, {
      password,
      app_metadata: { role: "admin" },
    });
    if (updateError) throw updateError;
  } else {
    const { error: createError } = await supabase.auth.admin.createUser({
      email: masterEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (createError) throw new Error(`Gagal membuat ${masterEmail}: ${createError.message}`);
  }

  // Only after the master account works, remove the other admins.
  const removed: string[] = [];
  for (const user of data.users) {
    if (user.app_metadata?.role !== "admin" || user.email?.toLowerCase() === masterEmail) continue;
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`Gagal menghapus ${user.email}: ${deleteError.message}`);
    removed.push(user.email ?? user.id);
  }

  console.log("\n================ SIMPAN SEKARANG — HANYA DITAMPILKAN SEKALI ================");
  console.log(`admin  ${masterEmail.padEnd(32)} ${password}`);
  console.log("=============================================================================");
  console.log(`Login cukup pakai nama akun: ${MASTER_ADMIN}`);
  console.log(removed.length > 0 ? `Akun admin lain dihapus: ${removed.join(", ")}\n` : "Tidak ada akun admin lain.\n");
}

main().catch((error) => {
  console.error(`\n✗ ${(error as Error).message}\n`);
  process.exit(1);
});
