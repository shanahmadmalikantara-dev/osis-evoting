# CLAUDE.md — E-Voting Ketua & Wakil Ketua MPK MAN 4 Jakarta

@AGENTS.md

Project rules. Read this before every change. This app lives in `mpk-evoting/` inside the OSIS
repo and is deployed as its own Vercel project (Root Directory `mpk-evoting`) with its own Supabase project.

## Language
- Talk to the owner (Ahmad) in simple Indonesian; he is not very technical.
- Code, identifiers, and comments: English. Text shown in the UI: Indonesian.

## Context (owner decisions, 26 Oct 2026)
- Same app and design as the OSIS election, but voters vote on their OWN phones (mobile layout), at school with supervisors.
- Only 4 groups may vote: Ketua Eskul, Perwakilan Kelas, OSIS/MPK 2025/2026, Calon OSIS/MPK 2026/2027.
- Voters do not log in. They pick kelompok -> kelas -> their own name from a roster the admin entered, then a candidate.
- One person = one vote. Someone in two groups is ONE roster row (unique nama + kelas) and gets one vote.
- After voting the phone shows "Terima kasih" and stays there (cookie), the name is crossed out for everyone.
- The admin CAN see who voted and for whom, and can cancel one person's vote (audit logged) so they can vote again.
- 2 dummy candidates (editable).
- Priorities: (1) one tap = exactly one correctly recorded vote, (2) one person one vote, (3) simple and robust.

## Stack
- Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, Realtime, Storage), Vercel free tier.

## Accounts
- Supabase Auth, NO sign-up page. One shared account `admin` (role `admin` in `app_metadata`), used on several laptops at once (logout is `scope: "local"`).
- `scripts/create-users.ts` (via `npm run setup`) creates it with a strong random password printed ONCE.

## Pages
- `/` — "Lanjut sebagai Admin" and "Lanjut sebagai Pemilih".
- `/pilih` — phone voting flow (no login). Waiting screen while not `open`. Confirm modal shows "Memilih sebagai <nama>", auto-cancels after 60 s. On network failure: error + retry, never "Terima kasih".
- `/admin` — live dashboard (total, % per candidate, turnout per group), open/close, trial mode, export CSV/PDF, wipe after closed.
- `/admin/pemilih` — roster: who voted for whom, cancel vote, delete name (no vote), paste from Excel, empty roster (draft only).
- `/admin/paslon`, `/admin/audit` — as in OSIS.

## Database (SQL migrations in `supabase/migrations`)
- OSIS migrations kept as-is; `20261026000001_mpk_voters.sql` adds `voters`, `votes.voter_id` (unique per mode), and the MPK functions.
- Votes enter ONLY through `cast_vote_voter(voter, candidate, submission_id)`, executable by service_role only (server action in `src/app/pilih/actions.ts`).
- `submission_id` generated on the phone per "Ya, kirim" tap, so retries never double count.
- Votes immutable (trigger) except `end_test` (test votes), `reset_election` (closed only, typed phrase) and `cancel_vote` (admin, audit logged).

## Security (MANDATORY — never loosen for convenience)
- RLS on every table, explicit GRANTs. anon: nothing. Admin: no direct SELECT/UPDATE/DELETE on `votes` or `voters`; reads via functions.
- service_role key only in server code and local scripts; never in client code or `NEXT_PUBLIC_*`. `.env.local` gitignored.
- The roster is only sent to phones while status is `open`.
- Login rate limiting for the admin login.

## Working rules
- Do everything that can be automated; never ask the owner to do automatable work.
- After changes: `npm run typecheck`, `npm run lint`, `npm test` (DB), `npm run test:e2e`; commit with a clear message.
- Small technical decisions: decide and record in README ("Keputusan teknis").
