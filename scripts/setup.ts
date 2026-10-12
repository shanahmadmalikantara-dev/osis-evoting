// LOCAL ONLY. One command to prepare a fresh Supabase project:
// 1) apply database migrations, 2) seed dummy candidates if empty, 3) create the 8 accounts.
//
// Usage: npm run setup
import { Client } from "pg";
import { createUsers } from "./create-users";
import { databaseUrlFromEnv } from "./lib/env";
import { applyMigrations, applySeed } from "./lib/migrate";

async function main() {
  const connectionString = databaseUrlFromEnv();
  const isLocal = /localhost|127\.0\.0\.1|host=\//.test(connectionString);
  const client = new Client({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("1/3 Memasang database...");
    const applied = await applyMigrations(client);
    if (applied.length === 0) console.log("  (sudah terpasang semua)");

    console.log("2/3 Mengisi paslon contoh...");
    const { rows } = await client.query("select count(*)::int as n from public.candidates");
    if (rows[0].n === 0) {
      await applySeed(client);
      console.log("  ✓ 4 paslon dummy ditambahkan (status: draft)");
    } else {
      console.log(`  (sudah ada ${rows[0].n} paslon, dilewati)`);
    }
  } finally {
    await client.end();
  }

  console.log("3/3 Membuat akun admin dan bilik...");
  await createUsers();
  console.log("Selesai ✓");
}

main().catch((error) => {
  const message = (error as Error).message;
  console.error(`\n✗ ${message}\n`);
  if (message.includes("fetch failed")) {
    console.error("  Tidak bisa menghubungi Supabase. Cek NEXT_PUBLIC_SUPABASE_URL di .env.local.\n");
  }
  process.exit(1);
});
