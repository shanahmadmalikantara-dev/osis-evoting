import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";

const ROOT = path.resolve(import.meta.dirname, "../..");
export const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
export const SEED_FILE = path.join(ROOT, "supabase/seed.sql");

// Applies every migration not yet recorded, each in its own transaction.
export async function applyMigrations(client: Client, log = console.log): Promise<string[]> {
  await client.query(`
    create schema if not exists app_meta;
    revoke all on schema app_meta from public;
    create table if not exists app_meta.applied_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query<{ name: string }>(
    "select name from app_meta.applied_migrations",
  );
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into app_meta.applied_migrations (name) values ($1)", [file]);
      await client.query("commit");
      log(`  ✓ ${file}`);
      newlyApplied.push(file);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return newlyApplied;
}

export async function applySeed(client: Client): Promise<void> {
  await client.query(await readFile(SEED_FILE, "utf8"));
}
