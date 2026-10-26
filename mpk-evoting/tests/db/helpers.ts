import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { applyMigrations, applySeed } from "../../scripts/lib/migrate";

// Tests run against a throwaway local Postgres, e.g.
// TEST_DATABASE_URL=postgres://postgres@localhost:54329/postgres
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const TEST_DB_NAME = "evoting_test";

export type Actor = {
  id: string;
  email: string;
  role: "admin" | "bilik" | "anon" | "none";
};

export async function createFreshDatabase(): Promise<Client> {
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB_NAME} with (force)`);
  await admin.query(`create database ${TEST_DB_NAME}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${TEST_DB_NAME}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  const shim = await readFile(path.resolve(import.meta.dirname, "../../supabase/tests/supabase-shim.sql"), "utf8");
  // Roles are cluster-wide; ignore "already exists" from a previous run.
  for (const statement of shim.split(/;\s*\n/)) {
    if (!statement.trim()) continue;
    try {
      await client.query(statement);
    } catch (error) {
      if (!/already exists/.test((error as Error).message)) throw error;
    }
  }
  await applyMigrations(client, () => {});
  await applySeed(client);
  return client;
}

export async function createUser(client: Client, label: string, role: Actor["role"]): Promise<Actor> {
  const actor: Actor = { id: randomUUID(), email: `${label}@osis.test`, role };
  if (role === "admin" || role === "bilik") {
    await client.query(
      "insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)",
      [actor.id, actor.email, { role }],
    );
  }
  return actor;
}

// Runs `fn` inside a transaction as the given API user, exactly like PostgREST does.
export async function as<T>(client: Client, actor: Actor, fn: () => Promise<T>): Promise<T> {
  const dbRole = actor.role === "anon" ? "anon" : "authenticated";
  const claims =
    actor.role === "anon"
      ? { role: "anon" }
      : { sub: actor.id, email: actor.email, role: "authenticated", app_metadata: actor.role === "none" ? {} : { role: actor.role } };
  await client.query("begin");
  try {
    await client.query(`set local role ${dbRole}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function candidateIds(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>("select id from public.candidates order by nomor_urut");
  return rows.map((r) => r.id);
}

export async function setCooldown(client: Client, seconds: number): Promise<void> {
  await client.query("update public.election set vote_cooldown_seconds = $1 where id = 1", [seconds]);
}

export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "no error";
}
