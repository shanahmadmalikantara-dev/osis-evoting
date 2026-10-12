// Maps database error keys from cast_vote() to Indonesian messages for the booth screen.
export type VoteErrorKind = "network" | "rate_limited" | "not_open" | "invalid_candidate" | "session" | "unknown";

export function classifyVoteError(message: string | undefined): VoteErrorKind {
  const text = message ?? "";
  if (text.includes("rate_limited")) return "rate_limited";
  if (text.includes("election_not_open")) return "not_open";
  if (text.includes("invalid_candidate")) return "invalid_candidate";
  if (text.includes("not_bilik") || /jwt|token|401/i.test(text)) return "session";
  if (/fetch|network|failed to|timeout|abort/i.test(text) || text === "") return "network";
  return "unknown";
}

export const VOTE_ERROR_TEXT: Record<VoteErrorKind, string> = {
  network: "Suara belum terkirim karena koneksi bermasalah. Tekan \"Coba lagi\".",
  rate_limited: "Bilik ini baru saja mengirim suara. Tunggu beberapa detik, lalu tekan \"Coba lagi\".",
  not_open: "Pemungutan suara sedang tidak dibuka. Hubungi petugas.",
  invalid_candidate: "Paslon tidak ditemukan. Hubungi petugas.",
  session: "Sesi laptop bilik habis. Hubungi petugas untuk login ulang.",
  unknown: "Terjadi kesalahan. Tekan \"Coba lagi\" atau hubungi petugas.",
};

// Errors where pressing "Coba lagi" with the same submission can succeed.
export const RETRYABLE: Record<VoteErrorKind, boolean> = {
  network: true,
  rate_limited: true,
  not_open: false,
  invalid_candidate: false,
  session: true,
  unknown: true,
};
