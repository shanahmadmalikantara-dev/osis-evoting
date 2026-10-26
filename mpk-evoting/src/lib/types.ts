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
  booths: { bilik_id: string; label: string; votes: number }[];
  generated_at: string;
};
