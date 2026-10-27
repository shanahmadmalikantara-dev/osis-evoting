import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TEST_DATABASE_URL,
  as,
  candidateIds,
  createFreshDatabase,
  createUser,
  errorOf,
  voterList,
  type Actor,
  type Voter,
} from "./helpers";

type Results = {
  status: string;
  test_mode: boolean;
  total: number;
  voters_total: number;
  candidates: { id: string; nomor_urut: number; votes: number }[];
  groups: { kelompok: string; label: string; total: number; voted: number }[];
};

type ListedVoter = { id: string; nama: string; voted_at: string | null; nomor_urut: number | null };

describe.skipIf(!TEST_DATABASE_URL)("database: MPK voting rules", () => {
  let db: Client;
  let admin: Actor;
  let server: Actor;
  let anon: Actor;
  let noRole: Actor;
  let candidates: string[];
  let voters: Voter[];

  const castVote = (actor: Actor, voterId: string, candidateId: string, submissionId: string = randomUUID()) =>
    as(db, actor, async () => {
      const { rows } = await db.query("select public.cast_vote_voter($1, $2, $3) as r", [
        voterId,
        candidateId,
        submissionId,
      ]);
      return rows[0].r as { ok: boolean; duplicate: boolean };
    });

  const call = (actor: Actor, fn: string, ...args: unknown[]) =>
    as(db, actor, async () => {
      const params = args.map((_, i) => `$${i + 1}`).join(", ");
      return (await db.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
    });

  const results = () => call(admin, "get_results") as Promise<Results>;
  const listed = () => call(admin, "list_voters") as Promise<ListedVoter[]>;
  const voteCount = async () => Number((await db.query("select count(*) from public.votes")).rows[0].count);
  const voterId = (nama: string) => voters.find((v) => v.nama === nama)!.id;

  beforeAll(async () => {
    db = await createFreshDatabase();
    admin = await createUser(db, "admin", "admin");
    server = await createUser(db, "server", "service");
    anon = await createUser(db, "anon", "anon");
    noRole = await createUser(db, "norole", "none");
    candidates = await candidateIds(db);
    voters = await voterList(db);
  });

  afterAll(async () => {
    await db?.end();
  });

  describe("draft state", () => {
    it("seeds 2 candidates and a dummy roster, starting in draft", async () => {
      expect(candidates).toHaveLength(2);
      expect(voters.length).toBeGreaterThan(8);
      const r = await results();
      expect(r.status).toBe("draft");
      expect(r.total).toBe(0);
      expect(r.voters_total).toBe(voters.length);
      expect(r.groups.map((g) => g.label)).toEqual([
        "Pimpinan",
        "Ketua Eskul",
        "Perwakilan Kelas",
        "OSIS/MPK 2025/2026",
        "Calon OSIS/MPK 2026/2027",
      ]);
    });

    it("rejects votes while the election is a draft", async () => {
      expect(await errorOf(castVote(server, voters[0].id, candidates[0]))).toMatch("election_not_open");
      expect(await voteCount()).toBe(0);
    });
  });

  describe("access control", () => {
    it("only the server can cast votes or read the roster", async () => {
      for (const actor of [admin, anon, noRole]) {
        expect(await errorOf(castVote(actor, voters[0].id, candidates[0]))).toMatch("permission denied");
        expect(await errorOf(call(actor, "voter_roster"))).toMatch("permission denied");
        expect(await errorOf(call(actor, "voter_has_voted", voters[0].id))).toMatch("permission denied");
      }
    });

    it("nobody reads votes or the voters table through the API", async () => {
      for (const actor of [admin, anon, noRole]) {
        for (const sql of ["select * from public.votes", "select * from public.voters"]) {
          expect(await errorOf(as(db, actor, () => db.query(sql)))).toMatch("permission denied");
        }
      }
    });

    it("admin cannot insert, update, or delete votes directly", async () => {
      for (const sql of [
        "update public.votes set candidate_id = candidate_id",
        "delete from public.votes where true",
        "insert into public.votes (candidate_id, voter_id, submission_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid())",
      ]) {
        expect(await errorOf(as(db, admin, () => db.query(sql)))).toMatch("permission denied");
      }
    });

    it("roster management is admin only", async () => {
      expect(await errorOf(call(noRole, "list_voters"))).toMatch("not_admin");
      expect(await errorOf(call(anon, "list_voters"))).toMatch("permission denied");
      expect(await errorOf(call(noRole, "import_voters", JSON.stringify([{ nama: "X", kelas: "X-1", kelompok: "ketua_eskul" }])))).toMatch("not_admin");
      expect(await errorOf(call(noRole, "cancel_vote", voters[0].id))).toMatch("not_admin");
      expect(await errorOf(call(noRole, "get_results"))).toMatch("not_admin");
    });

    it("anonymous users have no table access at all", async () => {
      for (const sql of [
        "select * from public.candidates",
        "select * from public.election",
        "select * from public.audit_logs",
      ]) {
        expect(await errorOf(as(db, anon, () => db.query(sql)))).toMatch("permission denied");
      }
    });
  });

  describe("roster", () => {
    it("imports new people and skips someone already on the roster, even in another group", async () => {
      const r = (await call(
        admin,
        "import_voters",
        JSON.stringify([
          { nama: "  Zaki   Firmansyah ", kelas: "XI-5", kelompok: "ketua_eskul" },
          { nama: "andi saputra", kelas: "x-1", kelompok: "ketua_eskul" },
        ]),
      )) as { inserted: number; skipped: { nama: string }[] };
      expect(r.inserted).toBe(1);
      expect(r.skipped.map((s) => s.nama)).toEqual(["andi saputra"]);
      voters = await voterList(db);
      expect(voters.find((v) => v.nama === "Zaki Firmansyah")?.kelompok).toBe("ketua_eskul");
    });

    it("rejects a row with an unknown group and imports nothing from that batch", async () => {
      const before = voters.length;
      const err = await errorOf(
        call(admin, "import_voters", JSON.stringify([
          { nama: "Baru Satu", kelas: "X-9", kelompok: "ketua_eskul" },
          { nama: "Baru Dua", kelas: "X-9", kelompok: "guru" },
        ])),
      );
      expect(err).toMatch("invalid_input");
      expect((await voterList(db)).length).toBe(before);
    });

    it("accepts the Pimpinan group", async () => {
      const r = (await call(
        admin,
        "import_voters",
        JSON.stringify([{ nama: "Ibu Contoh, M.Pd.", kelas: "Pimpinan", kelompok: "pimpinan" }]),
      )) as { inserted: number };
      expect(r.inserted).toBe(1);
      await call(admin, "delete_voter", (await voterList(db)).find((v) => v.nama === "Ibu Contoh, M.Pd.")!.id);
    });

    it("deletes a roster entry without a vote", async () => {
      await call(admin, "delete_voter", voterId("Zaki Firmansyah"));
      voters = await voterList(db);
      expect(voters.some((v) => v.nama === "Zaki Firmansyah")).toBe(false);
    });
  });

  describe("trial run (mode uji coba)", () => {
    it("trial votes count separately and the same person can vote for real afterwards", async () => {
      await call(admin, "start_test");
      const andi = voterId("Andi Saputra");
      expect(await castVote(server, andi, candidates[1])).toEqual({ ok: true, duplicate: false });
      expect(await errorOf(castVote(server, andi, candidates[0]))).toMatch("already_voted");
      expect(await call(server, "voter_has_voted", andi)).toBe(true);
      expect((await results()).total).toBe(1);

      expect(await call(admin, "end_test")).toEqual({ deleted_test_votes: 1 });
      expect(await voteCount()).toBe(0);
      expect(await call(server, "voter_has_voted", andi)).toBe(false);
    });
  });

  describe("real voting", () => {
    beforeAll(async () => {
      await call(admin, "open_voting");
    });

    it("rejects unknown candidates and unknown voters", async () => {
      expect(await errorOf(castVote(server, voters[0].id, randomUUID()))).toMatch("invalid_candidate");
      expect(await errorOf(castVote(server, randomUUID(), candidates[0]))).toMatch("voter_not_found");
    });

    it("one person, one vote", async () => {
      const andi = voterId("Andi Saputra");
      await castVote(server, andi, candidates[0]);
      expect(await errorOf(castVote(server, andi, candidates[1]))).toMatch("already_voted");
      const roster = (await call(server, "voter_roster")) as { id: string; voted: boolean }[];
      expect(roster.find((v) => v.id === andi)?.voted).toBe(true);
      expect(await voteCount()).toBe(1);
    });

    it("two phones voting for the same person at the same moment: only one vote counts", async () => {
      const bunga = voterId("Bunga Lestari");
      const { Client } = await import("pg");
      const url = new URL(TEST_DATABASE_URL!);
      url.pathname = "/mpk_evoting_test";
      const other = new Client({ connectionString: url.toString() });
      await other.connect();
      try {
        const attempts = await Promise.allSettled([
          castVote(server, bunga, candidates[0]),
          other.query("select public.cast_vote_voter($1, $2, $3)", [bunga, candidates[1], randomUUID()]),
        ]);
        expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
      } finally {
        await other.end();
      }
      const n = await db.query("select count(*) from public.votes where voter_id = $1", [bunga]);
      expect(Number(n.rows[0].count)).toBe(1);
    });

    it("same submission_id sent twice records only one vote", async () => {
      const citra = voterId("Citra Maharani");
      const submission = randomUUID();
      const before = await voteCount();
      expect(await castVote(server, citra, candidates[1], submission)).toEqual({ ok: true, duplicate: false });
      expect(await castVote(server, citra, candidates[1], submission)).toEqual({ ok: true, duplicate: true });
      expect(await errorOf(castVote(server, voterId("Dafa Hidayat"), candidates[1], submission))).toMatch(
        "submission_conflict",
      );
      expect(await voteCount()).toBe(before + 1);
    });

    it("admin sees who voted and for whom", async () => {
      const list = await listed();
      const andi = list.find((v) => v.nama === "Andi Saputra")!;
      expect(andi.nomor_urut).toBe(1);
      expect(andi.voted_at).not.toBeNull();
      expect(list.find((v) => v.nama === "Eka Wulandari")!.voted_at).toBeNull();
    });

    it("a voter with a vote cannot be deleted from the roster", async () => {
      expect(await errorOf(call(admin, "delete_voter", voterId("Andi Saputra")))).toMatch("voter_has_vote");
    });

    it("admin can cancel one vote so that person can vote again, and it is audited", async () => {
      const andi = voterId("Andi Saputra");
      const before = await voteCount();
      await call(admin, "cancel_vote", andi);
      expect(await voteCount()).toBe(before - 1);
      expect(await errorOf(call(admin, "cancel_vote", andi))).toMatch("no_vote");
      const audit = await as(db, admin, async () =>
        (await db.query("select aksi from public.audit_logs order by id desc limit 1")).rows[0].aksi as string,
      );
      expect(audit).toBe("Membatalkan suara Andi Saputra (X-1)");
      await castVote(server, andi, candidates[1]);
      expect((await listed()).find((v) => v.id === andi)!.nomor_urut).toBe(2);
    });

    it("the cancel flag cannot be abused to delete votes directly", async () => {
      const err = await errorOf(
        as(db, admin, async () => {
          await db.query("select set_config('app.cancel_vote', 'on', true)");
          await db.query("delete from public.votes where true");
        }),
      );
      expect(err).toMatch("permission denied");
      expect(await errorOf(db.query("delete from public.votes where true"))).toMatch("votes_are_immutable");
      expect(await errorOf(db.query("update public.votes set candidate_id = candidate_id"))).toMatch(
        "votes_are_immutable",
      );
    });

    it("everyone on the roster votes: recount matches the dashboard, per candidate and per group", async () => {
      const already = new Set((await listed()).filter((v) => v.voted_at).map((v) => v.id));
      for (const [i, v] of voters.entries()) {
        if (!already.has(v.id)) await castVote(server, v.id, candidates[i % 2]);
      }
      const r = await results();
      expect(r.total).toBe(voters.length);
      for (const g of r.groups) expect(g.voted).toBe(g.total);

      const { rows } = await db.query<{ candidate_id: string; n: string }>(
        "select candidate_id, count(*) as n from public.votes where not is_test group by candidate_id",
      );
      const recount = new Map(rows.map((row) => [row.candidate_id, Number(row.n)]));
      for (const c of r.candidates) expect(recount.get(c.id) ?? 0).toBe(c.votes);
    });
  });

  describe("closed", () => {
    it("closing rejects further votes and locks the roster", async () => {
      await call(admin, "cancel_vote", voterId("Eka Wulandari"));
      await call(admin, "close_voting");
      expect(await errorOf(castVote(server, voterId("Eka Wulandari"), candidates[0]))).toMatch("election_not_open");
      expect(await errorOf(call(admin, "import_voters", JSON.stringify([{ nama: "Telat", kelas: "X-1", kelompok: "ketua_eskul" }])))).toMatch("roster_locked");
      expect(await errorOf(call(admin, "clear_voters"))).toMatch("roster_locked");
    });

    it("reset wipes every vote and the roster can then be replaced", async () => {
      await call(admin, "reset_election", "HAPUS SEMUA SUARA");
      expect(await voteCount()).toBe(0);
      const r = (await call(admin, "clear_voters")) as { deleted: number };
      expect(r.deleted).toBe(voters.length);
      expect((await results()).voters_total).toBe(0);
    });
  });
});
