import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_DATABASE_URL,
  as,
  candidateIds,
  createFreshDatabase,
  createUser,
  errorOf,
  setCooldown,
  type Actor,
} from "./helpers";

type Results = {
  status: string;
  test_mode: boolean;
  total: number;
  candidates: { id: string; nomor_urut: number; votes: number }[];
  booths: { label: string; votes: number }[];
};

describe.skipIf(!TEST_DATABASE_URL)("database: voting rules", () => {
  let db: Client;
  let admin: Actor;
  let booths: Actor[];
  let anon: Actor;
  let noRole: Actor;
  let candidates: string[];

  const castVote = (actor: Actor, candidateId: string, submissionId: string = randomUUID()) =>
    as(db, actor, async () => {
      const { rows } = await db.query("select public.cast_vote($1, $2) as r", [candidateId, submissionId]);
      return rows[0].r as { ok: boolean; duplicate: boolean };
    });

  const call = (actor: Actor, fn: string) =>
    as(db, actor, async () => (await db.query(`select public.${fn}() as r`)).rows[0].r);

  const results = () => call(admin, "get_results") as Promise<Results>;

  const voteCount = async () =>
    Number((await db.query("select count(*) from public.votes")).rows[0].count);

  beforeAll(async () => {
    db = await createFreshDatabase();
    admin = await createUser(db, "admin1", "admin");
    booths = [];
    for (let i = 1; i <= 8; i++) booths.push(await createUser(db, `bilik${i}`, "bilik"));
    anon = await createUser(db, "anon", "anon");
    noRole = await createUser(db, "norole", "none");
    candidates = await candidateIds(db);
  });

  afterAll(async () => {
    await db?.end();
  });

  describe("draft state", () => {
    it("seeds 4 candidates and starts in draft", async () => {
      expect(candidates).toHaveLength(4);
      const r = await results();
      expect(r.status).toBe("draft");
      expect(r.total).toBe(0);
      expect(r.booths.map((b) => b.label)).toEqual(["bilik1", "bilik2", "bilik3", "bilik4", "bilik5", "bilik6", "bilik7", "bilik8"]);
    });

    it("rejects votes while the election is a draft", async () => {
      expect(await errorOf(castVote(booths[0], candidates[0]))).toMatch("election_not_open");
      expect(await voteCount()).toBe(0);
    });
  });

  describe("access control", () => {
    it("bilik can read candidates but not votes", async () => {
      const rows = await as(db, booths[0], async () => (await db.query("select * from public.candidates")).rows);
      expect(rows).toHaveLength(4);
      expect(await errorOf(as(db, booths[0], () => db.query("select * from public.votes")))).toMatch(
        "permission denied",
      );
    });

    it("bilik cannot insert votes directly, only through cast_vote", async () => {
      const err = await errorOf(
        as(db, booths[0], () =>
          db.query("insert into public.votes (candidate_id, bilik_id, submission_id) values ($1, $2, $3)", [
            candidates[0],
            booths[0].id,
            randomUUID(),
          ]),
        ),
      );
      expect(err).toMatch("permission denied");
    });

    it("bilik cannot read results, audit logs, or run admin functions", async () => {
      expect(await errorOf(call(booths[0], "get_results"))).toMatch("not_admin");
      expect(await errorOf(call(booths[0], "open_voting"))).toMatch("not_admin");
      const audit = await as(db, booths[0], async () => (await db.query("select * from public.audit_logs")).rows);
      expect(audit).toHaveLength(0);
    });

    it("bilik cannot edit candidates", async () => {
      const updated = await as(db, booths[0], async () =>
        (await db.query("update public.candidates set nama_ketua = 'X'")).rowCount,
      );
      expect(updated).toBe(0);
    });

    it("admin cannot cast votes", async () => {
      expect(await errorOf(castVote(admin, candidates[0]))).toMatch("not_bilik");
    });

    it("anonymous users have no access at all", async () => {
      for (const sql of [
        "select * from public.candidates",
        "select * from public.election",
        "select * from public.votes",
        "select * from public.audit_logs",
      ]) {
        expect(await errorOf(as(db, anon, () => db.query(sql)))).toMatch("permission denied");
      }
      expect(await errorOf(castVote(anon, candidates[0]))).toMatch("permission denied");
      expect(await errorOf(call(anon, "get_results"))).toMatch("permission denied");
    });

    it("a logged-in user without a role gets nothing", async () => {
      const rows = await as(db, noRole, async () => (await db.query("select * from public.candidates")).rows);
      expect(rows).toHaveLength(0);
      expect(await errorOf(castVote(noRole, candidates[0]))).toMatch("not_bilik");
      expect(await errorOf(call(noRole, "get_results"))).toMatch("not_admin");
    });

    it("nobody can change the election row directly", async () => {
      const err = await errorOf(as(db, admin, () => db.query("update public.election set status = 'open'")));
      expect(err).toMatch("permission denied");
    });

    it("nobody can write audit logs directly", async () => {
      const err = await errorOf(
        as(db, admin, () => db.query("insert into public.audit_logs (aktor, aksi) values ('x', 'palsu')")),
      );
      expect(err).toMatch("permission denied");
      expect(await errorOf(as(db, admin, () => db.query("select public.write_audit('palsu')")))).toMatch(
        "permission denied",
      );
    });
  });

  describe("trial run (mode uji coba)", () => {
    it("counts trial votes separately and purges them when the trial ends", async () => {
      await call(admin, "start_test");
      const r1 = await castVote(booths[0], candidates[1]);
      expect(r1).toEqual({ ok: true, duplicate: false });

      let r = await results();
      expect(r.test_mode).toBe(true);
      expect(r.total).toBe(1);

      // Candidates are locked while voting (even a trial) is open.
      const err = await errorOf(
        as(db, admin, () => db.query("update public.candidates set nama_ketua = 'X' where nomor_urut = 1")),
      );
      expect(err).toMatch("candidates_locked");

      const end = await call(admin, "end_test");
      expect(end).toEqual({ deleted_test_votes: 1 });
      expect(await voteCount()).toBe(0);

      r = await results();
      expect(r.status).toBe("draft");
      expect(r.test_mode).toBe(false);
    });

    it("admin can edit candidates in draft, and it is audited", async () => {
      await as(db, admin, () =>
        db.query("update public.candidates set visi_misi = visi_misi || ' (revisi)' where nomor_urut = 1"),
      );
      const audit = await as(db, admin, async () =>
        (await db.query("select aktor, aksi from public.audit_logs order by id desc limit 1")).rows[0],
      );
      expect(audit.aktor).toBe("admin1@osis.test");
      expect(audit.aksi).toMatch(/^Mengubah paslon 1/);
    });
  });

  describe("real voting", () => {
    beforeAll(async () => {
      await call(admin, "open_voting");
    });

    beforeEach(async () => {
      await setCooldown(db, 8);
    });

    it("cannot go back to draft or start a trial once real voting is open", async () => {
      expect(await errorOf(call(admin, "start_test"))).toMatch("invalid_transition");
      expect(await errorOf(call(admin, "end_test"))).toMatch("invalid_transition");
      expect(await errorOf(call(admin, "open_voting"))).toMatch("invalid_transition");
    });

    it("rejects an unknown candidate", async () => {
      expect(await errorOf(castVote(booths[4], randomUUID()))).toMatch("invalid_candidate");
    });

    it("records a vote with the booth id and no voter identity", async () => {
      await castVote(booths[2], candidates[0]);
      const { rows } = await db.query("select * from public.votes");
      expect(rows).toHaveLength(1);
      expect(rows[0].bilik_id).toBe(booths[2].id);
      expect(rows[0].is_test).toBe(false);
      expect(Object.keys(rows[0]).sort()).toEqual(
        ["bilik_id", "candidate_id", "created_at", "id", "is_test", "submission_id"].sort(),
      );
    });

    it("same submission_id sent twice records only one vote", async () => {
      const before = await voteCount();
      const submission = randomUUID();
      expect(await castVote(booths[3], candidates[1], submission)).toEqual({ ok: true, duplicate: false });
      expect(await castVote(booths[3], candidates[1], submission)).toEqual({ ok: true, duplicate: true });
      expect(await voteCount()).toBe(before + 1);
    });

    it("another booth cannot reuse someone else's submission_id", async () => {
      const submission = randomUUID();
      await castVote(booths[1], candidates[2], submission);
      expect(await errorOf(castVote(booths[4], candidates[2], submission))).toMatch("submission_conflict");
    });

    it("20 rapid calls from one booth: only the first is recorded, the rest are rate limited", async () => {
      const before = await voteCount();
      let ok = 0;
      let limited = 0;
      for (let i = 0; i < 20; i++) {
        const err = await errorOf(castVote(booths[0], candidates[i % 4]));
        if (err === "no error") ok++;
        else if (err.includes("rate_limited")) limited++;
      }
      expect(ok).toBe(1);
      expect(limited).toBe(19);
      expect(await voteCount()).toBe(before + 1);
    });

    it("admin cannot read, update, or delete individual votes", async () => {
      for (const sql of [
        "select * from public.votes",
        "update public.votes set candidate_id = candidate_id",
        "delete from public.votes",
      ]) {
        expect(await errorOf(as(db, admin, () => db.query(sql)))).toMatch("permission denied");
      }
    });

    it("even the database owner cannot update, delete, or truncate real votes", async () => {
      expect(await errorOf(db.query("update public.votes set candidate_id = candidate_id"))).toMatch(
        "votes_are_immutable",
      );
      expect(await errorOf(db.query("delete from public.votes"))).toMatch("votes_are_immutable");
      expect(await errorOf(db.query("truncate public.votes"))).toMatch("votes_are_immutable");
    });

    it("candidates are locked during voting", async () => {
      const err = await errorOf(
        as(db, admin, () => db.query("delete from public.candidates where nomor_urut = 4")),
      );
      expect(err).toMatch("candidates_locked");
    });

    it("8 booths voting in turns: recount matches the dashboard totals", async () => {
      await setCooldown(db, 0);
      const before = await results();
      const expected = new Map(before.candidates.map((c) => [c.id, c.votes]));
      const perBooth = new Map(before.booths.map((b) => [b.label, b.votes]));

      // 96 votes: each round, every booth votes once, cycling through candidates.
      for (let round = 0; round < 12; round++) {
        for (let b = 0; b < booths.length; b++) {
          const candidate = candidates[(round * 5 + b * 3) % 4];
          await castVote(booths[b], candidate);
          expected.set(candidate, (expected.get(candidate) ?? 0) + 1);
          perBooth.set(`bilik${b + 1}`, (perBooth.get(`bilik${b + 1}`) ?? 0) + 1);
        }
      }

      const after = await results();
      expect(after.total).toBe(before.total + 12 * booths.length);
      for (const c of after.candidates) expect(c.votes).toBe(expected.get(c.id));
      for (const b of after.booths) expect(b.votes).toBe(perBooth.get(b.label));

      // Independent recount straight from the votes table.
      const { rows } = await db.query<{ candidate_id: string; n: string }>(
        "select candidate_id, count(*) as n from public.votes where not is_test group by candidate_id",
      );
      const recount = new Map(rows.map((r) => [r.candidate_id, Number(r.n)]));
      for (const c of after.candidates) expect(recount.get(c.id) ?? 0).toBe(c.votes);
      expect([...recount.values()].reduce((a, b) => a + b, 0)).toBe(after.total);
    });

    it("bumps results_version on every vote (for the live dashboard)", async () => {
      await setCooldown(db, 0);
      const read = async () =>
        Number((await as(db, admin, () => db.query("select version from public.results_version"))).rows[0].version);
      const v1 = await read();
      await castVote(booths[4], candidates[0]);
      expect(await read()).toBe(v1 + 1);
    });
  });

  describe("closed", () => {
    it("closing is final and rejects further votes", async () => {
      await call(admin, "close_voting");
      expect(await errorOf(castVote(booths[0], candidates[0]))).toMatch("election_not_open");
      expect(await errorOf(call(admin, "open_voting"))).toMatch("invalid_transition");
      expect(await errorOf(call(admin, "start_test"))).toMatch("invalid_transition");
      expect((await results()).status).toBe("closed");
    });

    it("every lifecycle step is in the audit log", async () => {
      const rows = await as(db, admin, async () =>
        (await db.query("select aksi from public.audit_logs order by id")).rows.map((r) => r.aksi as string),
      );
      expect(rows).toEqual(
        expect.arrayContaining([
          "Memulai mode uji coba",
          "Mengakhiri mode uji coba (1 suara uji dibersihkan)",
          "Membuka pemungutan suara",
          "Menutup pemungutan suara",
        ]),
      );
    });
  });
});
