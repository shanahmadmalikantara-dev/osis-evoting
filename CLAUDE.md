# CLAUDE.md — E-Voting Ketua & Wakil Ketua OSIS MAN 4 Jakarta

@AGENTS.md

Project rules. Read this before every change.

## Language
- Talk to the owner (Ahmad) in simple Indonesian; he is not very technical.
- Code, identifiers, and comments: English. Text shown in the UI: Indonesian.

## Context
- Voting happens at school on 8 "booth" laptops; ~1300 voters (students, teachers, staff) queue and take turns.
- Voter verification is done manually by officers outside the app. The app stores NO voter identity at all.
- Priorities, in order: (1) one click = exactly one correctly recorded vote, (2) ballot secrecy, (3) simple and robust on election day.

## Stack
- Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, Realtime, Storage), deployed on Vercel free tier.
- Latest stable versions. Install only libraries that are really needed.

## Accounts
- Supabase Auth, NO sign-up page. Accounts are created by a local script.
- Role `admin`: 1 shared account `admin`, used on several laptops at the same time (logout only ends that laptop's session). Role `bilik`: 8 accounts (one per laptop).
- Role lives in `app_metadata.role`; checked on the server AND in RLS.
- `scripts/create-users.ts` uses the service_role key from `.env.local` (LOCAL ONLY), creates the admin and 8 booth accounts with strong random passwords, prints email+password ONCE in the terminal.

## Pages
1. `/` — two big buttons: "Lanjut sebagai Admin" and "Lanjut sebagai Penyuara".
2. `/bilik` (role bilik only; long login session so the laptop stays logged in all day)
   - Equal-size candidate cards (photo, ballot number, chair & vice names); layout adapts to the number of candidates in the DB.
   - Click card -> confirm modal "Yakin memilih Paslon X?" [Ya, kirim] [Batal]; modal auto-cancels after 60 s.
   - After "Ya, kirim": lock buttons (no double click), call `cast_vote`, show "Terima kasih" for 4 s, then return to the cards.
   - On send failure (network): show error + retry button; NEVER show "Terima kasih".
   - No menu, no logout button, no links to other pages.
   - If election status is not `open`: show "Pemungutan suara belum dibuka / sudah ditutup".
3. `/admin/login` then `/admin` (role admin only)
   - LIVE dashboard (Supabase Realtime, polling as fallback): total votes, votes + % per candidate, bar chart, votes per booth.
   - Open / Close voting buttons with confirmation.
   - Manage candidates (names, photo, vision-mission) only while status is `draft`; photos via Supabase Storage.
   - Export results (CSV and PDF) and audit log of admin actions.
   - Votes cannot be deleted or reset, EXCEPT one owner-approved path (Ahmad, 22 Oct 2026): after status is `closed`, an admin can wipe all votes and return to `draft` via `reset_election(confirm phrase)` from the dashboard. Never allow it in any other status.

## Database (SQL migrations in `supabase/migrations`)
- `candidates` (id, nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi)
- `election` (id, status: draft|open|closed)
- `votes` (id, candidate_id, bilik_id, submission_id UNIQUE, created_at) — NO voter identity
- `audit_logs` (id, aktor, aksi, waktu)

## Security (MANDATORY — never loosen for convenience)
- All votes go through ONE function `cast_vote(candidate_id, submission_id uuid)`, SECURITY DEFINER, which checks: role = bilik, status = open, candidate valid, max 1 vote per 8 s per booth; inserts with `bilik_id = auth.uid()`.
- `submission_id` is generated on the client on every "Ya, kirim" click, so network retries never record a duplicate vote.
- RLS on every table. Bilik: may only read `candidates` and execute `cast_vote`; may NOT select `votes`. Admin: may read results, may NOT update/delete `votes`. Anonymous: no access.
- service_role key only in local scripts and server code; never in client code or `NEXT_PUBLIC_*` vars. `.env.local` is gitignored.
- Rate-limit login attempts (admin and bilik).
- Explicit GRANT statements needed by the Supabase Data API.

## Design & placeholder data
- If `design/` has content, study and follow it. Otherwise clean, neutral UI.
- All colors, fonts, radii, spacing centralized as design tokens (Tailwind theme + CSS variables). UI components (candidate card, button, modal) kept separate so they are easy to restyle.
- Candidate photos: local SVG placeholders in `public/dummy` (4 different images). Seed script fills 4 fictional candidates, status `draft`.

## Phases
1. Project setup, DB schema, RLS, `cast_vote`, seed, DB function tests
2. Auth + role guards + home page
3. Booth page
4. Live admin dashboard + open/close voting
5. Manage candidates + photo upload + export + audit log
6. Security test script, README, election-day doc (`docs/HARI-H.md`), deploy guide

## Working rules
- Do everything that can be automated; never ask the owner to do automatable work.
- End of every phase: run typecheck, lint, tests; git commit with a clear message; short report (what's done, what to check, max 3 points).
- Stop and wait for the owner ONLY after phase 1, after phase 4, after phase 6. Otherwise keep going.
- Small technical decisions: decide, and record the reason in README ("Keputusan teknis"). Ask only what truly cannot be guessed.

## Required automated tests (before phase 6 is done)
- Bilik reads `votes` via API -> denied
- Bilik opens `/admin` -> denied
- 20 rapid `cast_vote` calls from one booth -> rate limited
- Same `submission_id` sent twice -> only one vote recorded
- Voting while status is draft or closed -> denied
- Admin tries UPDATE/DELETE on `votes` -> denied
- 8 booths voting alternately, then recount total and per-candidate -> matches

## Election-day doc (`docs/HARI-H.md`)
Short non-technical steps: log in all 8 laptops the day before, open Chrome kiosk mode straight to `/bilik`, cast one test vote then clear test data with a safe procedure before real voting, how to open/close voting, how to export results, what to do if a laptop or the internet fails.
