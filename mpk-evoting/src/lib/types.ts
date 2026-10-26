export type ElectionStatus = "draft" | "open" | "closed";

export type Candidate = {
  id: string;
  nomor_urut: number;
  nama_ketua: string;
  nama_wakil: string;
  foto_url: string | null;
  visi_misi: string;
};

export type ElectionState = {
  status: ElectionStatus;
  test_mode: boolean;
};

export type Results = {
  status: ElectionStatus;
  test_mode: boolean;
  opened_at: string | null;
  closed_at: string | null;
  total: number;
  candidates: { id: string; nomor_urut: number; nama_ketua: string; nama_wakil: string; votes: number }[];
  voters_total: number;
  groups: { kelompok: string; label: string; total: number; voted: number }[];
  generated_at: string;
};

// Roster entry as the voter page sees it.
export type RosterVoter = {
  id: string;
  nama: string;
  kelas: string;
  kelompok: string;
  voted: boolean;
};

// Roster entry as the admin sees it, with the vote (owner decision: admins may see choices).
export type ListedVoter = {
  id: string;
  nama: string;
  kelas: string;
  kelompok: string;
  voted_at: string | null;
  nomor_urut: number | null;
};
