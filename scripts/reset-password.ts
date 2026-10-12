// LOCAL ONLY. Gives one account a new random password and prints it once.
// Usage: npm run reset-password -- bilik3
import { createClient } from "@supabase/supabase-js";
import { generatePassword } from "./create-users";
import { requireEnv } from "./lib/env";

async function main() {
  const name = process.argv[2]?.trim().toLowerCase();
  if (!name) {
    console.error("\nTulis nama akunnya, contoh: npm run reset-password -- bilik3\n");
    process.exit(1);
  }
  const domain = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-osis.local";
  const email = name.includes("@") ? name : `${name}@${domain}`;

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    console.error(`\n✗ Akun ${email} tidak ditemukan.\n`);
    process.exit(1);
  }

  const password = generatePassword();
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (updateError) throw updateError;

  console.log(`\nPassword baru (simpan sekarang, hanya tampil sekali):\n${email}  ${password}\n`);
}

main().catch((error) => {
  console.error(`\n✗ ${(error as Error).message}\n`);
  process.exit(1);
});
