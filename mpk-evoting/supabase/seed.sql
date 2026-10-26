-- Two fictional candidate pairs and a small fictional roster for development.
-- Election stays in draft. Safe to run more than once.

insert into public.candidates (nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi)
values
  (1, 'Raka Aditya', 'Salma Nurhaliza', '/dummy/paslon-1.svg',
   'Visi: MPK yang mendengar suara kelas. Misi: rapat aspirasi rutin dengan perwakilan kelas.'),
  (2, 'Bima Prasetyo', 'Alya Rahmawati', '/dummy/paslon-2.svg',
   'Visi: MPK yang tegas dan transparan. Misi: laporan kerja OSIS dibuka tiap bulan.')
on conflict (nomor_urut) do nothing;

insert into public.voters (nama, kelas, kelompok)
values
  ('Andi Saputra', 'X-1', 'perwakilan_kelas'),
  ('Bunga Lestari', 'X-2', 'perwakilan_kelas'),
  ('Citra Maharani', 'XI-1', 'perwakilan_kelas'),
  ('Dafa Hidayat', 'XI-2', 'perwakilan_kelas'),
  ('Eka Wulandari', 'XII-1', 'perwakilan_kelas'),
  ('Farhan Akbar', 'XI-3', 'ketua_eskul'),
  ('Gita Permata', 'X-3', 'ketua_eskul'),
  ('Hana Safitri', 'XII-2', 'ketua_eskul'),
  ('Irfan Maulana', 'XII-3', 'osis_mpk_lama'),
  ('Jihan Aulia', 'XI-4', 'osis_mpk_lama'),
  ('Kevin Ramadhan', 'X-4', 'calon_osis_mpk'),
  ('Laila Zahra', 'X-1', 'calon_osis_mpk')
on conflict do nothing;
