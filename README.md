# E-Voting Ketua & Wakil Ketua OSIS MAN 4 Jakarta

Aplikasi pemungutan suara untuk 5 laptop bilik. Aplikasi tidak menyimpan identitas pemilih.
Aturan proyek lengkap ada di [CLAUDE.md](CLAUDE.md).

## Menjalankan

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run setup                # pasang database + paslon dummy + 8 akun (sekali saja)
npm run dev
```

## Tes

```bash
npm run check   # typecheck + lint + tes
```

Tes database butuh Postgres lokal (bukan proyek Supabase asli). Isi `TEST_DATABASE_URL`,
misalnya `postgres://postgres@localhost:5432/postgres`. Tanpa variabel itu, tes database dilewati.
GitHub Actions menjalankan semuanya otomatis di setiap push.

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
