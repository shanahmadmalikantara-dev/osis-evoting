// Security check against a REAL setup (your Supabase project + the running app).
// Safe to run before election day: it only works while the election is in DRAFT, runs everything
// inside Mode Uji Coba, and ends the trial afterwards (test votes are purged, real data untouched).
// It creates temporary test accounts and deletes them again at the end.
//
// Usage: npm run test:security                 (app at http://localhost:3000)
//        APP_URL=https://xxx.vercel.app npm run test:security
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generatePassword } from "./create-users";
import { requireEnv, supabaseUrlFromEnv } from "./lib/env";

const SUPABASE_URL = supabaseUrlFromEnv();
const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DOMAIN = process.env.AUTH_EMAIL_DOMAIN?.trim() || "pemilu-osis.local";
const PREFIX = "sec-check";

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
type Results = { total: number; candidates: { id: string; votes: number }[]; booths: { bilik_id: string; votes: number }[] };

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createTestUser(label: string, role: "admin" | "bilik"): Promise<TestUser> {
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
  const booths: TestUser[] = [];
  for (let i = 1; i <= 5; i++) booths.push(await createTestUser(`bilik${i}`, "bilik"));
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  const { data: candidateRows } = await service.from("candidates").select("id").order("nomor_urut");
  const candidates = (candidateRows ?? []).map((c) => c.id as string);
  assert(candidates.length > 0, "Belum ada paslon");

  const castVote = (user: TestUser, candidateId: string, submissionId: string = randomUUID()) =>
    user.client.rpc("cast_vote", { p_candidate_id: candidateId, p_submission_id: submissionId });

  let trialStarted = false;
  try {
    await check("Akun anonim tidak bisa membaca tabel apa pun", async () => {
      for (const table of ["candidates", "election", "votes", "audit_logs"]) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        assert(error || (data ?? []).length === 0, `anon bisa membaca ${table}`);
      }
    });

    await check("Pendaftaran akun baru dimatikan", async () => {
      const { error } = await anon.auth.signUp({ email: `${PREFIX}-signup-${Date.now()}@${DOMAIN}`, password: generatePassword() });
      assert(error, 'Pendaftaran masih terbuka. Matikan "Allow new users to sign up" di Supabase.');
    });

    await check("Voting saat status draft ditolak", async () => {
      const { error } = await castVote(booths[0], candidates[0]);
      assert(error?.message.includes("election_not_open"), `harusnya ditolak, hasil: ${error?.message ?? "diterima"}`);
    });

    await check("Akun bilik membaca tabel votes lewat API ditolak", async () => {
      const { data, error } = await booths[0].client.from("votes").select("*").limit(1);
      assert(error || (data ?? []).length === 0, "bilik bisa membaca suara");
      return error ? "permission denied" : "0 baris";
    });

    await check("Akun bilik tidak bisa memasukkan suara langsung ke tabel", async () => {
      const { error } = await booths[0].client
        .from("votes")
        .insert({ candidate_id: candidates[0], bilik_id: booths[0].id, submission_id: randomUUID() });
      assert(error, "insert langsung berhasil");
    });

    await check("Akun bilik tidak bisa membuka/menutup voting atau melihat hasil", async () => {
      for (const fn of ["open_voting", "close_voting", "start_test", "get_results"]) {
        const { error } = await booths[0].client.rpc(fn);
        assert(error, `${fn} berhasil dipanggil oleh bilik`);
      }
    });

    await check("Akun bilik membuka /admin ditolak", async () => {
      const cookie = await appCookies(booths[0].email, booths[0].password);
      const response = await fetch(`${APP_URL}/admin`, { headers: { cookie }, redirect: "manual" });
      assert(response.status === 403, `status ${response.status}, harusnya 403`);
      const exportResponse = await fetch(`${APP_URL}/admin/export/csv`, { headers: { cookie }, redirect: "manual" });
      assert(exportResponse.status === 403, `ekspor: status ${exportResponse.status}, harusnya 403`);
      return "403";
    });

    // Everything below casts votes, so it runs inside a trial run that is purged afterwards.
    const { error: startError } = await admin.client.rpc("start_test");
    if (startError) throw new Error(`Gagal memulai uji coba: ${startError.message}`);
    trialStarted = true;

    await check("20 permintaan cast_vote cepat dari satu bilik kena batas", async () => {
      const responses = await Promise.all(Array.from({ length: 20 }, () => castVote(booths[0], candidates[0])));
      const ok = responses.filter((r) => !r.error).length;
      const limited = responses.filter((r) => r.error?.message.includes("rate_limited")).length;
      assert(ok === 1 && limited === 19, `diterima ${ok}, dibatasi ${limited}`);
      return "1 diterima, 19 dibatasi";
    });

    await check("submission_id yang sama dikirim dua kali hanya tercatat satu", async () => {
      const submission = randomUUID();
      const before = (await service.from("votes").select("*", { count: "exact", head: true })).count ?? 0;
      const first = await castVote(booths[1], candidates[0], submission);
      const second = await castVote(booths[1], candidates[0], submission);
      const after = (await service.from("votes").select("*", { count: "exact", head: true })).count ?? 0;
      assert(!first.error && !second.error, first.error?.message ?? second.error?.message ?? "");
      assert(after - before === 1, `bertambah ${after - before} suara`);
    });

    await check("Admin tidak bisa membaca, mengubah, atau menghapus suara", async () => {
      const read = await admin.client.from("votes").select("*").limit(1);
      assert(read.error || (read.data ?? []).length === 0, "admin bisa membaca baris suara");
      const update = await admin.client.from("votes").update({ candidate_id: candidates[0] }).not("id", "is", null);
      assert(update.error, "UPDATE berhasil");
      const del = await admin.client.from("votes").delete().not("id", "is", null);
      assert(del.error, "DELETE berhasil");
    });

    await check("Simulasi 5 bilik bergantian, hitung ulang cocok", async () => {
      await sleep(8_500); // cooldown from the previous checks
      const before = (await admin.client.rpc("get_results")).data as Results;
      const expected = new Map(before.candidates.map((c) => [c.id, c.votes]));
      const perBooth = new Map(before.booths.map((b) => [b.bilik_id, b.votes]));
      let cast = 0;

      for (let round = 0; round < 3; round++) {
        if (round > 0) await sleep(8_500);
        for (let b = 0; b < booths.length; b++) {
          const candidate = candidates[(round + b) % candidates.length];
          const { error } = await castVote(booths[b], candidate);
          if (error) throw new Error(`bilik${b + 1}: ${error.message}`);
          expected.set(candidate, (expected.get(candidate) ?? 0) + 1);
          perBooth.set(booths[b].id, (perBooth.get(booths[b].id) ?? 0) + 1);
          cast++;
        }
      }

      const after = (await admin.client.rpc("get_results")).data as Results;
      assert(after.total === before.total + cast, `total ${after.total}, harusnya ${before.total + cast}`);
      for (const c of after.candidates) assert(c.votes === expected.get(c.id), `paslon ${c.id} tidak cocok`);
      for (const b of after.booths) {
        if (perBooth.has(b.bilik_id)) assert(b.votes === perBooth.get(b.bilik_id), "jumlah per bilik tidak cocok");
      }

      // Independent recount straight from the table (service role).
      const { data: rows } = await service.from("votes").select("candidate_id").eq("is_test", true);
      const recount = new Map<string, number>();
      for (const r of rows ?? []) recount.set(r.candidate_id, (recount.get(r.candidate_id) ?? 0) + 1);
      for (const c of after.candidates) assert((recount.get(c.id) ?? 0) === c.votes, "hitung ulang tidak cocok");
      return `${cast} suara, total & per paslon & per bilik cocok`;
    });
  } finally {
    if (trialStarted) {
      const { error } = await admin.client.rpc("end_test");
      console.log(error ? `\n⚠ Gagal mengakhiri uji coba: ${error.message}` : "\n(Uji coba diakhiri, suara uji dibersihkan.)");
    }
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
