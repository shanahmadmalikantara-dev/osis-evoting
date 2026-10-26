// Security check against a REAL setup (your Supabase project + the running app).
// Safe to run before election day: it only works while the election is in DRAFT, runs everything
// inside Mode Uji Coba, and ends the trial afterwards (test votes are purged, real data untouched).
// It creates temporary test accounts and roster names and deletes them again at the end.
//
// Usage: npm run test:security                 (app at http://localhost:3100)
//        APP_URL=https://xxx.vercel.app npm run test:security
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generatePassword } from "./create-users";
import { requireEnv, supabaseUrlFromEnv } from "./lib/env";

const SUPABASE_URL = supabaseUrlFromEnv();
const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
const DOMAIN = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-mpk.local";
const PREFIX = "sec-check";

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
type Results = { total: number; candidates: { id: string; votes: number }[] };

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const outcomes: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail = "") {
  outcomes.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    record(name, true, detail ?? "");
  } catch (error) {
    record(name, false, (error as Error).message);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}


async function createTestUser(label: string, role: "admin" | "none"): Promise<TestUser> {
  const email = `${PREFIX}-${label}@${DOMAIN}`;
  const password = generatePassword(24);
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) throw new Error(`Gagal membuat akun uji ${email}: ${error.message}`);
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(`Gagal login ${email}: ${loginError.message}`);
  return { id: data.user.id, email, password, client };
}

async function deleteTestUsers() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.startsWith(`${PREFIX}-`)) await service.auth.admin.deleteUser(user.id);
  }
}

// Logs in the way the app does (Supabase SSR cookies) and returns the cookie header for app requests.
async function appCookies(email: string, password: string): Promise<string> {
  const jar = new Map<string, string>();
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await ssr.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function main() {
  console.log(`\nUji keamanan\n  Supabase: ${SUPABASE_URL}\n  Aplikasi: ${APP_URL}\n`);

  const { data: election } = await service.from("election").select("status, test_mode").eq("id", 1).single();
  if (election?.status !== "draft") {
    console.error("✗ Status pemilihan bukan draft. Uji keamanan hanya boleh dijalankan sebelum voting dibuka.\n");
    process.exit(1);
  }
  const { count: existingVotes } = await service.from("votes").select("*", { count: "exact", head: true });
  if (existingVotes) {
    console.error("✗ Tabel suara tidak kosong. Hentikan dulu sebelum menjalankan uji.\n");
    process.exit(1);
  }

  await deleteTestUsers();
  const admin = await createTestUser("admin", "admin");
  const stranger = await createTestUser("tanpa-peran", "none");
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  const { data: candidateRows } = await service.from("candidates").select("id").order("nomor_urut");
  const candidates = (candidateRows ?? []).map((c) => c.id as string);
  assert(candidates.length > 0, "Belum ada paslon");

  // The voter page calls this through the server with the service_role key.
  const castVote = (client: SupabaseClient, voterId: string, candidateId: string, submissionId: string = randomUUID()) =>
    client.rpc("cast_vote_voter", { p_voter_id: voterId, p_candidate_id: candidateId, p_submission_id: submissionId });

  // Temporary roster entries, removed again at the end. Real names are never touched.
  const tempVoters: string[] = [];
  const addTempVoters = async (count: number) => {
    const rows = Array.from({ length: count }, (_, i) => ({
      nama: `${PREFIX} ${Date.now()}-${tempVoters.length + i}`,
      kelas: "UJI",
      kelompok: "perwakilan_kelas",
    }));
    const { error } = await admin.client.rpc("import_voters", { p_rows: rows });
    if (error) throw new Error(`Gagal menambah pemilih uji: ${error.message}`);
    const { data } = await service.from("voters").select("id").in("nama", rows.map((r) => r.nama));
    const ids = (data ?? []).map((v) => v.id as string);
    tempVoters.push(...ids);
    return ids;
  };

  let trialStarted = false;
  try {
    await check("Akun anonim tidak bisa membaca tabel apa pun", async () => {
      for (const table of ["candidates", "election", "votes", "voters", "audit_logs"]) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        assert(error || (data ?? []).length === 0, `anon bisa membaca ${table}`);
      }
    });

    await check("Pendaftaran akun baru dimatikan", async () => {
      const { error } = await anon.auth.signUp({ email: `${PREFIX}-signup-${Date.now()}@${DOMAIN}`, password: generatePassword() });
      assert(error, 'Pendaftaran masih terbuka. Matikan "Allow new users to sign up" di Supabase.');
    });

    const [probe] = await addTempVoters(1);

    await check("Anonim dan admin tidak bisa memanggil fungsi suara langsung", async () => {
      for (const client of [anon, admin.client, stranger.client]) {
        const { error } = await castVote(client, probe, candidates[0]);
        assert(error, "cast_vote_voter bisa dipanggil tanpa server");
        const roster = await client.rpc("voter_roster");
        assert(roster.error, "daftar pemilih bisa dibaca tanpa server");
      }
    });

    await check("Voting saat status draft ditolak", async () => {
      const { error } = await castVote(service, probe, candidates[0]);
      assert(error?.message.includes("election_not_open"), `harusnya ditolak, hasil: ${error?.message ?? "diterima"}`);
    });

    await check("Admin tidak bisa membaca, mengubah, atau menghapus suara, atau membaca tabel pemilih", async () => {
      const read = await admin.client.from("votes").select("*").limit(1);
      assert(read.error || (read.data ?? []).length === 0, "admin bisa membaca baris suara");
      const update = await admin.client.from("votes").update({ candidate_id: candidates[0] }).not("id", "is", null);
      assert(update.error, "UPDATE berhasil");
      const del = await admin.client.from("votes").delete().not("id", "is", null);
      assert(del.error, "DELETE berhasil");
      const voters = await admin.client.from("voters").select("*").limit(1);
      assert(voters.error || (voters.data ?? []).length === 0, "admin bisa membaca tabel pemilih langsung");
    });

    await check("Akun tanpa peran admin tidak bisa membuka /admin atau ekspor", async () => {
      const cookie = await appCookies(stranger.email, stranger.password);
      for (const path of ["/admin", "/admin/pemilih", "/admin/export/csv"]) {
        const response = await fetch(`${APP_URL}${path}`, { headers: { cookie }, redirect: "manual" });
        assert([302, 303, 307, 403].includes(response.status), `${path}: status ${response.status}`);
      }
      const results = await stranger.client.rpc("list_voters");
      assert(results.error, "list_voters bisa dipanggil");
    });

    // Everything below casts votes, so it runs inside a trial run that is purged afterwards.
    const { error: startError } = await admin.client.rpc("start_test");
    if (startError) throw new Error(`Gagal memulai uji coba: ${startError.message}`);
    trialStarted = true;

    await check("Satu orang hanya bisa memilih sekali", async () => {
      const first = await castVote(service, probe, candidates[0]);
      assert(!first.error, first.error?.message ?? "");
      const second = await castVote(service, probe, candidates[0]);
      assert(second.error?.message.includes("already_voted"), `suara kedua: ${second.error?.message ?? "diterima"}`);
    });

    await check("submission_id yang sama dikirim dua kali hanya tercatat satu", async () => {
      const [voter] = await addTempVoters(1);
      const submission = randomUUID();
      const first = await castVote(service, voter, candidates[0], submission);
      const second = await castVote(service, voter, candidates[0], submission);
      assert(!first.error && !second.error, first.error?.message ?? second.error?.message ?? "");
      const { count } = await service.from("votes").select("*", { count: "exact", head: true }).eq("voter_id", voter);
      assert(count === 1, `tercatat ${count} suara`);
    });

    await check("Admin bisa membatalkan satu suara, lalu orang itu bisa memilih lagi", async () => {
      const { error } = await admin.client.rpc("cancel_vote", { p_voter_id: probe });
      assert(!error, error?.message ?? "");
      const again = await castVote(service, probe, candidates[candidates.length - 1]);
      assert(!again.error, again.error?.message ?? "");
    });

    await check("20 pemilih bergantian, hitung ulang cocok", async () => {
      const voters = await addTempVoters(20);
      const before = (await admin.client.rpc("get_results")).data as Results;
      const expected = new Map(before.candidates.map((c) => [c.id, c.votes]));
      for (const [i, voter] of voters.entries()) {
        const candidate = candidates[i % candidates.length];
        const { error } = await castVote(service, voter, candidate);
        if (error) throw new Error(error.message);
        expected.set(candidate, (expected.get(candidate) ?? 0) + 1);
      }
      const after = (await admin.client.rpc("get_results")).data as Results;
      assert(after.total === before.total + voters.length, `total ${after.total}`);
      for (const c of after.candidates) assert(c.votes === expected.get(c.id), `paslon ${c.id} tidak cocok`);

      const { data: rows } = await service.from("votes").select("candidate_id").eq("is_test", true);
      const recount = new Map<string, number>();
      for (const r of rows ?? []) recount.set(r.candidate_id, (recount.get(r.candidate_id) ?? 0) + 1);
      for (const c of after.candidates) assert((recount.get(c.id) ?? 0) === c.votes, "hitung ulang tidak cocok");
      return `${voters.length} suara, total & per paslon cocok`;
    });
  } finally {
    if (trialStarted) {
      const { error } = await admin.client.rpc("end_test");
      console.log(error ? `\n⚠ Gagal mengakhiri uji coba: ${error.message}` : "\n(Uji coba diakhiri, suara uji dibersihkan.)");
    }
    for (const id of tempVoters) await admin.client.rpc("delete_voter", { p_voter_id: id });
    await deleteTestUsers();
  }

  const failed = outcomes.filter((o) => !o.ok);
  console.log(`\n${outcomes.length - failed.length}/${outcomes.length} lolos.`);
  console.log("Catatan: 'voting saat status closed ditolak' diuji di tes database (npm test), karena menutup voting itu final.\n");
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error(`\n✗ ${(error as Error).message}\n`);
  await deleteTestUsers().catch(() => {});
  process.exit(1);
});
