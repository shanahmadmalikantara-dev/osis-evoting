// Maps database error keys from cast_vote_voter() to Indonesian messages for the voter page.
export type VoteErrorKind =
  | "network"
  | "not_open"
  | "invalid_candidate"
  | "already_voted"
  | "voter_not_found"
  | "unknown";

export function classifyVoteError(message: string | undefined): VoteErrorKind {
  const text = message ?? "";
  if (text.includes("election_not_open")) return "not_open";
  if (text.includes("invalid_candidate")) return "invalid_candidate";
  if (text.includes("already_voted")) return "already_voted";
  if (text.includes("voter_not_found")) return "voter_not_found";
  if (/fetch|network|failed to|timeout|abort/i.test(text) || text === "") return "network";
  return "unknown";
}

export const VOTE_ERROR_TEXT: Record<VoteErrorKind, string> = {
  network: "Suara belum terkirim karena koneksi bermasalah. Tekan \"Coba lagi\".",
  not_open: "Pemungutan suara sedang tidak dibuka. Tanya pengawas.",
  invalid_candidate: "Paslon tidak ditemukan. Tanya pengawas.",
  already_voted: "Nama ini sudah dipakai untuk memilih. Kalau itu bukan kamu, lapor ke pengawas.",
  voter_not_found: "Nama ini tidak ada di daftar pemilih. Tanya pengawas.",
  unknown: "Terjadi kesalahan. Tekan \"Coba lagi\" atau tanya pengawas.",
};

// Errors where pressing "Coba lagi" with the same submission can succeed.
export const RETRYABLE: Record<VoteErrorKind, boolean> = {
  network: true,
  not_open: false,
  invalid_candidate: false,
  already_voted: false,
  voter_not_found: false,
  unknown: true,
};
