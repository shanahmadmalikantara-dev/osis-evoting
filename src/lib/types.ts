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
