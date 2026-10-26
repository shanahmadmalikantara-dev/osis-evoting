# E-Voting Ketua & Wakil Ketua MPK MAN 4 Jakarta

Versi MPK dari aplikasi pemilu OSIS: pemilih memilih lewat **HP masing-masing**, dengan memilih kelompok, kelas, dan namanya sendiri dari daftar yang diisi panitia. Satu orang satu suara.

- Aturan proyek: [CLAUDE.md](CLAUDE.md)
- Panduan pasang (Supabase + Vercel baru): [docs/DEPLOY.md](docs/DEPLOY.md)
- Panduan hari-H untuk panitia: [docs/HARI-H.md](docs/HARI-H.md)

## Halaman

| Alamat | Untuk | Isi |
|---|---|---|
| `/` | semua | Tombol "Lanjut sebagai Admin" dan "Lanjut sebagai Pemilih" |
| `/pilih` | pemilih (tanpa login) | Kelompok → kelas → nama → kartu paslon → konfirmasi → "Terima kasih" (final) |
| `/admin` | admin | Dashboard live, kehadiran per kelompok, buka/tutup voting, uji coba, ekspor CSV/PDF |
| `/admin/pemilih` | admin | Daftar pemilih, siapa memilih siapa, batalkan suara, tempel dari Excel |
| `/admin/paslon` | admin | Tambah/ubah/hapus paslon dan foto (hanya saat draft) |
| `/admin/audit` | admin | Catatan semua aksi admin |

## Perintah (jalankan di folder `mpk-evoting`)

```bash
npm install
cp .env.example .env.local      # isi nilainya (lihat docs/DEPLOY.md)
npm run setup                   # pasang database + 2 paslon & daftar pemilih contoh + akun admin
npm run dev                     # http://localhost:3000

npm run check                   # typecheck + lint + tes database
npm run test:e2e                # tes browser (Supabase lokal, port 55321, app di :3100)
npm run test:security           # uji keamanan ke proyek asli (hanya saat status draft)
npm run reset-password -- admin # password admin baru
```

## Tes

- `npm test`: 22 tes fungsi database (butuh `TEST_DATABASE_URL`).
- `npm run test:e2e`: 21 tes browser, termasuk alur HP dan halaman Pemilih.
- `npm run test:security`: 10 cek ke proyek asli, dijalankan di dalam Mode Uji Coba lalu dibersihkan.
- GitHub Actions menjalankan semuanya lewat `.github/workflows/mpk-ci.yml` setiap ada perubahan di folder ini.

## Keputusan teknis

| Keputusan | Alasan |
|---|---|
| Pemilih tidak login; memilih nama dari daftar (kelompok → kelas → nama). | Pilihan Ahmad (26 Okt 2026). Voting di sekolah dengan pengawas. Konsekuensi: siapa pun yang tahu alamat web saat voting dibuka bisa memilih atas nama orang yang belum memilih. Pengawas mengawasi, dan admin bisa membatalkan suara yang salah. |
| Daftar pemilih hanya dikirim ke HP saat status **Dibuka**. | Nama perwakilan tidak terbuka untuk umum di luar waktu voting. |
| Satu orang satu baris (unik nama + kelas), meskipun masuk 2 kelompok. | Pilihan Ahmad: 1 orang 1 suara. Saat tempel dari Excel, baris kedua otomatis dilewati dan dilaporkan. |
| Suara masuk lewat server (`cast_vote_voter`, hanya service_role), bukan langsung dari browser. | Browser pemilih tidak punya akses database sama sekali. Fungsi di database mengunci per orang, jadi dua HP yang memilih nama sama bersamaan tetap hanya tercatat satu. |
| HP yang sudah memilih menyimpan cookie dan tetap di layar "Terima kasih". | Pilihan Ahmad: HP masing-masing, setelah memilih web "tertutup". Kalau suaranya dibatalkan admin atau uji coba diakhiri, HP itu bisa dipakai memilih lagi. |
| Admin bisa melihat nama + pilihan, dan ikut di ekspor CSV (PDF hanya angka). | Pilihan Ahmad (26 Okt 2026). Pilihan ini membuat suara **tidak rahasia** bagi admin. |
| Admin bisa membatalkan satu suara (`cancel_vote`), tercatat di audit log tanpa isi pilihan. | Pilihan Ahmad untuk kasus nama dobel / salah pilih nama. Hanya lewat fungsi ini; tabel suara tetap tidak bisa diubah langsung. |
| Uji coba memakai `is_test`; satu orang boleh punya 1 suara uji + 1 suara sungguhan. | Orang yang ikut uji coba tetap bisa memilih sungguhan setelah uji coba diakhiri. |
| Halaman pemilih memperbarui status tiap 10 detik (polling), bukan Realtime. | Pemilih tidak login, dan Realtime butuh izin baca tabel. |
| Folder terpisah di repo yang sama, proyek Vercel dan Supabase sendiri. | Pilihan Ahmad: website terpisah dengan alamat sendiri. Data OSIS dan MPK tidak tercampur. |
| Tombol/aplikasi cadangan Windows dan akun bilik dihapus. | Tidak ada laptop bilik; setiap pemilih memakai HP sendiri. |
| Keputusan lain (alur status, reset setelah ditutup, batas login, desain detektif, ekspor) | Sama dengan aplikasi OSIS, lihat README di folder utama. |
