import { invoke } from "@tauri-apps/api/core";
import type { Candidate } from "@/lib/types";

// Talks to the Rust side (src-tauri). Outside the Windows app (plain browser, used for
// development and the automated tests) a localStorage stand-in with the same rules is used.

export type Status = "ready" | "open" | "closed";

export type PublicState = {
  configured: boolean;
  bilik: number | null;
  site_url: string | null;
  candidates: Candidate[];
  synced_at: string | null;
  status: Status;
};

export type Report = {
  bilik: number;
  status: Status;
  total: number;
  unknown: number;
  rows: { nomor_urut: number; nama_ketua: string; nama_wakil: string; votes: number }[];
  file_hash: string;
};

export const DEFAULT_SITE_URL = "https://osis-evoting-4ojs.vercel.app";
export const RESET_PHRASE = "HAPUS";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return inTauri ? invoke<T>(command, args) : (mock(command, args ?? {}) as Promise<T>);
}

export const api = {
  getState: () => call<PublicState>("get_state"),
  setup: (bilik: number, pin: string, siteUrl: string, candidates: Candidate[], syncedAt: string) =>
    call<void>("setup", { bilik, pin, siteUrl, candidates, syncedAt }),
  verifyPin: (pin: string) => call<void>("verify_pin", { pin }),
  updateCandidates: (pin: string, siteUrl: string, candidates: Candidate[], syncedAt: string) =>
    call<void>("update_candidates", { pin, siteUrl, candidates, syncedAt }),
  setStatus: (pin: string, status: Status) => call<void>("set_status", { pin, status }),
  castVote: (id: string, candidateId: string) => call<void>("cast_vote", { id, candidateId }),
  report: (pin: string) => call<Report>("report", { pin }),
  exportFiles: (pin: string) => call<string>("export_files", { pin }),
  resetVotes: (pin: string, confirm: string) => call<number>("reset_votes", { pin, confirm }),
  quit: (pin: string) => call<void>("quit_app", { pin }),
};

// Downloads the candidate list (with photos) from the website. Needs internet: done on H-1.
export async function fetchCandidates(siteUrl: string): Promise<{ candidates: Candidate[]; syncedAt: string }> {
  const base = siteUrl.trim().replace(/\/+$/, "");
  const response = await fetch(`${base}/api/cadangan/paslon`, { cache: "no-store" });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const body = (await response.json()) as { candidates: Candidate[]; generated_at: string };
  if (!Array.isArray(body.candidates) || body.candidates.length === 0) throw new Error("no_candidates");
  return { candidates: body.candidates, syncedAt: body.generated_at };
}

const ERROR_TEXT: Record<string, string> = {
  pin_wrong: "PIN salah.",
  invalid_pin: "PIN harus 4 sampai 8 angka.",
  election_not_open: "Voting cadangan sedang tidak dibuka. Hubungi petugas.",
  invalid_candidate: "Paslon tidak ditemukan. Hubungi petugas.",
  votes_not_empty: "Data paslon tidak bisa diganti karena sudah ada suara di laptop ini.",
  no_candidates: "Belum ada data paslon.",
  reset_confirm_mismatch: `Tulisan konfirmasi tidak cocok. Ketik persis: ${RESET_PHRASE}`,
  already_configured: "Aplikasi sudah pernah disiapkan.",
  not_configured: "Aplikasi belum disiapkan.",
};

export function errorText(error: unknown): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  const locked = /^pin_locked:(\d+)/.exec(message);
  if (locked) return `Terlalu banyak PIN salah. Coba lagi dalam ${locked[1]} detik.`;
  if (/^http_|fetch|network|load failed/i.test(message)) {
    return "Gagal mengambil data dari website. Pastikan laptop terhubung internet dan alamat website benar.";
  }
  return ERROR_TEXT[message] ?? "Terjadi kesalahan. Coba lagi atau hubungi petugas.";
}

// ---------------------------------------------------------------------------
// Browser stand-in (development and tests only; the Windows app never uses it).
// ---------------------------------------------------------------------------
type MockDb = {
  config: (Omit<PublicState, "configured"> & { pin: string }) | null;
  votes: { id: string; c: string }[];
  failures: number;
};

const KEY = "pemilu-cadangan-mock";

function load(): MockDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through
  }
  return { config: null, votes: [], failures: 0 };
}

async function mock(command: string, args: Record<string, unknown>): Promise<unknown> {
  const db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const config = () => {
    if (!db.config) throw "not_configured";
    return db.config;
  };
  const checkPin = () => {
    if (db.failures >= 5) throw "pin_locked:60";
    if (args.pin !== config().pin) {
      db.failures += 1;
      save();
      throw db.failures >= 5 ? "pin_locked:60" : "pin_wrong";
    }
    db.failures = 0;
    save();
  };
  const report = (): Report => {
    const c = config();
    const rows = c.candidates.map((x) => ({
      nomor_urut: x.nomor_urut,
      nama_ketua: x.nama_ketua,
      nama_wakil: x.nama_wakil,
      votes: db.votes.filter((v) => v.c === x.id).length,
    }));
    const known = rows.reduce((a, r) => a + r.votes, 0);
    return { bilik: c.bilik!, status: c.status, total: db.votes.length, unknown: db.votes.length - known, rows, file_hash: "mock" };
  };

  switch (command) {
    case "get_state":
      return db.config
        ? { configured: true, ...Object.fromEntries(Object.entries(db.config).filter(([k]) => k !== "pin")) }
        : { configured: false, bilik: null, site_url: null, candidates: [], synced_at: null, status: "ready" };
    case "setup":
      if (db.config) throw "already_configured";
      if (!/^\d{4,8}$/.test(String(args.pin))) throw "invalid_pin";
      db.config = {
        bilik: args.bilik as number,
        site_url: args.siteUrl as string,
        candidates: args.candidates as Candidate[],
        synced_at: args.syncedAt as string,
        status: "ready",
        pin: args.pin as string,
      };
      return save();
    case "verify_pin":
      return checkPin();
    case "update_candidates":
      checkPin();
      if (db.votes.length) throw "votes_not_empty";
      Object.assign(config(), { candidates: args.candidates, site_url: args.siteUrl, synced_at: args.syncedAt });
      return save();
    case "set_status":
      checkPin();
      config().status = args.status as Status;
      return save();
    case "cast_vote": {
      const c = config();
      if (c.status !== "open") throw "election_not_open";
      if (!c.candidates.some((x) => x.id === args.candidateId)) throw "invalid_candidate";
      if (!db.votes.some((v) => v.id === args.id)) db.votes.push({ id: args.id as string, c: args.candidateId as string });
      return save();
    }
    case "report":
      checkPin();
      return report();
    case "export_files":
      checkPin();
      return "C:\\Users\\petugas\\Documents\\Pemilu OSIS Cadangan\\contoh";
    case "reset_votes": {
      checkPin();
      if (String(args.confirm).trim() !== RESET_PHRASE) throw "reset_confirm_mismatch";
      const n = db.votes.length;
      db.votes = [];
      config().status = "ready";
      save();
      return n;
    }
    case "quit_app":
      checkPin();
      return;
    default:
      throw `unknown_command:${command}`;
  }
}
