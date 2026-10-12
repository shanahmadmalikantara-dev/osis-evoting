-- Four fictional candidate pairs for development. Election stays in draft.
-- Safe to run more than once.

insert into public.candidates (nomor_urut, nama_ketua, nama_wakil, foto_url, visi_misi)
values
  (1, 'Rafi Pratama', 'Nadia Salsabila', '/dummy/paslon-1.svg',
   'Visi: OSIS yang dekat dengan siswa. Misi: kotak aspirasi digital tiap bulan.'),
  (2, 'Dimas Arya', 'Zahra Kamila', '/dummy/paslon-2.svg',
   'Visi: Madrasah hijau dan bersih. Misi: program bank sampah per kelas.'),
  (3, 'Fajar Ramadhan', 'Aisyah Putri', '/dummy/paslon-3.svg',
   'Visi: Siswa berprestasi dan berakhlak. Misi: kelompok belajar sebaya.'),
  (4, 'Hafiz Maulana', 'Keisha Anindya', '/dummy/paslon-4.svg',
   'Visi: Kreatif tanpa batas. Misi: festival seni dan bazar wirausaha siswa.')
on conflict (nomor_urut) do nothing;
