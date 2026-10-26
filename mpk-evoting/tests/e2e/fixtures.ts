import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

export const PASSWORD = "E2e-Test-Password-123";
export const DOMAIN = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-mpk.local";

export const E2E_USERS = {
  admin: { username: "e2e-admin", role: "admin" },
  // A Supabase account without the admin role (must be refused by the admin login).
  norole: { username: "e2e-norole", role: "none" },
  locked: { username: "e2e-locked", role: "admin" },
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

// TEST ONLY (local database): puts the election back into a known state, wipes votes and
// restores the seed roster.
// Unlike the dashboard's reset (closed elections only), this works in any state; tests only.
export async function resetElection(state: { status: "draft" | "open" | "closed"; testMode?: boolean }) {
  assertLocal();
  await withDb(async (db) => {
    await db.query("begin");
    await db.query("alter table public.votes disable trigger user");
    await db.query("delete from public.votes");
    await db.query("alter table public.votes enable trigger user");
    await db.query("delete from public.voters");
    await db.query(SEED_VOTERS);
    await db.query(
      "update public.election set status = $1, test_mode = $2, vote_cooldown_seconds = 0, opened_at = null, closed_at = null where id = 1",
      [state.status, state.testMode ?? false],
    );
    await db.query("commit");
  });
}

export async function setElectionStatus(status: "draft" | "open" | "closed") {
  await withDb((db) => db.query("update public.election set status = $1, test_mode = false where id = 1", [status]));
}

export async function countVotes(): Promise<{ total: number; byNumber: Record<number, number> }> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ nomor_urut: number; n: string }>(
      `select c.nomor_urut, count(v.id) as n
         from public.candidates c left join public.votes v on v.candidate_id = c.id
        group by c.nomor_urut order by c.nomor_urut`,
    );
    const byNumber = Object.fromEntries(rows.map((r) => [r.nomor_urut, Number(r.n)]));
    return { total: rows.reduce((sum, r) => sum + Number(r.n), 0), byNumber };
  });
}

const SEED_VOTERS = `
  insert into public.voters (nama, kelas, kelompok) values
    ('Andi Saputra', 'X-1', 'perwakilan_kelas'), ('Bunga Lestari', 'X-2', 'perwakilan_kelas'),
    ('Citra Maharani', 'XI-1', 'perwakilan_kelas'), ('Dafa Hidayat', 'XI-2', 'perwakilan_kelas'),
    ('Eka Wulandari', 'XII-1', 'perwakilan_kelas'), ('Farhan Akbar', 'XI-3', 'ketua_eskul'),
    ('Gita Permata', 'X-3', 'ketua_eskul'), ('Hana Safitri', 'XII-2', 'ketua_eskul'),
    ('Irfan Maulana', 'XII-3', 'osis_mpk_lama'), ('Jihan Aulia', 'XI-4', 'osis_mpk_lama'),
    ('Kevin Ramadhan', 'X-4', 'calon_osis_mpk'), ('Laila Zahra', 'X-1', 'calon_osis_mpk')`;

// TEST ONLY: restores the two seed candidates (election must be in draft, votes empty).
export async function resetCandidates() {
  assertLocal();
  const { readFile } = await import("node:fs/promises");
  const seed = await readFile("supabase/seed.sql", "utf8");
  await withDb(async (db) => {
    await db.query("delete from public.candidates");
    await db.query(seed.replace(/insert into public\.voters[\s\S]*$/, ""));
  });
}
