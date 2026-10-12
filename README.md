# E-Voting Ketua & Wakil Ketua OSIS MAN 4 Jakarta

Aplikasi pemungutan suara untuk 5 laptop bilik dan ±1300 pemilih. Aplikasi **tidak menyimpan identitas pemilih**.
Prioritasnya: (1) satu klik satu suara tercatat benar, (2) rahasia pilihan, (3) sederhana dan tahan banting di hari-H.

- Aturan proyek: [CLAUDE.md](CLAUDE.md)
- Panduan deploy (Supabase + Vercel): [docs/DEPLOY.md](docs/DEPLOY.md)
- Panduan hari-H untuk panitia: [docs/HARI-H.md](docs/HARI-H.md)

## Halaman

| Alamat | Untuk | Isi |
|---|---|---|
| `/` | semua | Tombol "Lanjut sebagai Admin" dan "Lanjut sebagai Penyuara" |
| `/bilik` | akun bilik | Kartu paslon → konfirmasi → kirim → "Terima kasih" (tanpa menu/logout/link) |
| `/admin` | akun admin | Dashboard live, buka/tutup voting, mode uji coba, ekspor CSV/PDF |
| `/admin/paslon` | akun admin | Tambah/ubah/hapus paslon dan foto (hanya saat draft) |
| `/admin/audit` | akun admin | Catatan semua aksi admin |

## Perintah

```bash
npm install
cp .env.example .env.local      # isi nilainya (lihat docs/DEPLOY.md)
npm run setup                   # pasang database + paslon dummy + 8 akun (sekali saja)
npm run dev                     # jalankan di http://localhost:3000

npm run check                   # typecheck + lint + tes database
npm run test:e2e                # tes browser (butuh Supabase lokal, lihat di bawah)
npm run test:security           # uji keamanan ke proyek asli (hanya saat status draft)
npm run create-users            # buat akun yang belum ada
npm run reset-password -- bilik3   # password baru untuk satu akun
```

## Struktur

```
supabase/migrations/   skema, fungsi cast_vote & admin, RLS + GRANT, storage, batas login
supabase/seed.sql      4 paslon dummy
scripts/               setup, create-users, reset-password, security-check (dijalankan lokal)
src/proxy.ts           refresh sesi + tolak role yang salah (403)
src/lib/               auth, klien Supabase, ekspor CSV/PDF, pesan error
src/components/ui/     Button, Sticker, Modal, Notice, PageShell (design tokens di globals.css)
src/components/booth/  layar bilik dan kartu paslon
src/components/admin/  dashboard, hasil, kelola paslon
tests/db/              26 tes fungsi database (Postgres biasa + shim Supabase)
tests/e2e/             23 tes browser Playwright (Supabase lokal)
```

## Tes

**Tes database** (`npm test`) butuh Postgres lokal. Isi `TEST_DATABASE_URL`, misalnya
`postgres://postgres@localhost:5432/postgres`. Tanpa variabel itu, tes database dilewati.

**Tes browser** (`npm run test:e2e`) butuh Supabase lokal (Docker): `npx supabase start`, lalu isi `.env.local`
dengan nilai dari `npx supabase status`. Tes ini menolak jalan kalau URL Supabase bukan lokal.

GitHub Actions menjalankan typecheck, lint, tes database, tes browser, dan uji keamanan di setiap push.

### Uji wajib dan di mana diuji

| Uji | Tes database | Tes browser | `test:security` |
|---|---|---|---|
| Bilik membaca tabel votes lewat API → ditolak | ✓ | | ✓ |
| Bilik membuka /admin → ditolak | | ✓ | ✓ |
| 20 cast_vote cepat dari satu bilik → kena batas | ✓ | | ✓ (paralel) |
| submission_id sama dua kali → satu suara | ✓ | ✓ (respons hilang + coba lagi) | ✓ |
| Voting saat draft / closed → ditolak | ✓ / ✓ | layar "belum dibuka" / "sudah ditutup" | ✓ / – |
| Admin UPDATE/DELETE votes → ditolak | ✓ | | ✓ |
| Simulasi 5 bilik lalu hitung ulang → cocok | ✓ | | ✓ |

## Keputusan teknis

| Keputusan | Alasan |
|---|---|
| **Mode Uji Coba**: suara uji ditandai `is_test`, dihapus saat uji diakhiri, status kembali `draft`. | Spesifikasi minta "tidak ada hapus suara" sekaligus "tes lalu hapus data uji". Suara sungguhan tidak pernah bisa dihapus. |
| Alur status satu arah: `draft → open → closed`. Hanya mode uji yang boleh kembali ke `draft`. | Mencegah reset hasil setelah voting sungguhan dimulai. |
| Trigger database menolak UPDATE, DELETE, dan TRUNCATE pada suara sungguhan, **termasuk** oleh service_role. | Lapisan pengaman kedua di luar RLS, misalnya kalau ada yang salah klik di dashboard Supabase. |
| Admin **tidak** membaca baris `votes` langsung, hanya angka gabungan lewat `get_results()`. | Rahasia pilihan: baris suara punya waktu dan bilik. Kalau digabung dengan antrean, bisa ditebak siapa memilih apa. |
| Dashboard live berlangganan tabel `results_version` (penghitung), lalu memanggil `get_results()`. | Realtime butuh izin SELECT, dan kita tidak mau memberi admin SELECT pada `votes`. |
| Jeda antar-suara per bilik disimpan di `election.vote_cooldown_seconds` (default 8). | Hanya pemilik database yang bisa mengubahnya. Tes memakai 0 supaya simulasi 5 bilik cepat. |
| `cast_vote` mengunci per bilik (`pg_advisory_xact_lock`). | Supaya dua klik bersamaan tidak lolos dari batas 8 detik. |
| Kirim ulang dengan `submission_id` yang sama dianggap sukses (`duplicate: true`) tanpa menambah suara. | Kalau jaringan putus setelah suara tersimpan, tombol "Coba lagi" aman ditekan. |
| Foto paslon disimpan di bucket publik `candidate-photos`. Hanya admin yang boleh upload, dan hanya saat `draft`. | Foto paslon adalah materi kampanye publik. URL publik membuat bilik tetap cepat. |
| Migrasi dijalankan oleh `npm run setup` lewat koneksi Postgres, dicatat di `app_meta.applied_migrations`. | Satu perintah untuk orang non-teknis, tanpa perlu memasang Supabase CLI atau Docker. |
| Tes database memakai Postgres biasa + `supabase/tests/supabase-shim.sql` yang meniru `auth.uid()`, role, dan grant bawaan Supabase. | Bisa dites di mana saja (termasuk CI) tanpa Docker. Shim sengaja memberi grant longgar supaya terbukti `REVOKE` kita bekerja. |
| Dashboard admin menampilkan suara per paslon secara **live** selama voting. | Pilihan Ahmad (12 Okt 2026), setelah diberi tahu risikonya: angka yang naik live bisa dicocokkan dengan antrean bilik. Mitigasi di hari-H: layar dashboard tidak dipasang di dekat bilik/antrean. |
| Batas login: 5 gagal per akun dan 30 gagal per IP, per 15 menit (disimpan sebagai hash, bukan IP mentah). | Semua laptop sekolah mungkin memakai satu IP publik, jadi batas IP dibuat lebih longgar supaya satu orang iseng tidak memblokir semua bilik. Supabase Auth juga punya batas bawaannya sendiri. |
| Tidak memakai Cache Components Next.js. | Semua halaman bergantung pada user yang login, jadi render dinamis biasa lebih sederhana. |
| Realtime diberi token user (`authorizeRealtime`) sebelum subscribe. | Tanpa token, RLS menyembunyikan perubahan baris dan dashboard hanya mengandalkan polling. |
| Foto diunggah langsung dari browser admin ke Storage, lalu server action menyimpan URL-nya (hanya URL bucket sendiri atau `/dummy/` yang diterima). | Menghindari batas ukuran body server action/Vercel. Policy Storage tetap membatasi ke admin saat draft. |
| CSV memakai pemisah `;` dan BOM UTF-8. | Excel dengan pengaturan wilayah Indonesia membaca kolomnya dengan benar. |
| PDF dibuat dengan `pdf-lib` dan font standar. | Ringan dan jalan di server Vercel tanpa browser. Karakter di luar Latin diganti `?` supaya ekspor tidak pernah gagal. |
| Login dan logout admin/bilik juga dicatat di audit log. | Membantu menelusuri kejadian di hari-H. Catatan ini tidak terhubung ke suara. |
| `npm run test:security` membuat akun uji sementara dan berjalan di dalam Mode Uji Coba. | Aman dijalankan ke proyek asli sebelum hari-H, tanpa meninggalkan data. Uji "voting saat closed" hanya ada di tes database karena menutup voting itu final. |
| Pendaftaran akun publik dimatikan (config lokal + langkah manual di dashboard Supabase). | Spesifikasi: tidak ada halaman daftar. Akun tanpa role pun tidak punya akses, tapi lebih aman ditutup. |
