# Panduan Deploy (Supabase + Vercel)

Cukup dilakukan sekali. Semua gratis.

## 1. Supabase (database + login)

1. Daftar atau masuk di https://supabase.com, lalu klik **New project**.
   - Name: `pemilu-osis`
   - Database password: buat yang kuat, lalu **simpan**
   - Region: **Southeast Asia (Singapore)**
2. Tunggu proyek siap, lalu catat 4 nilai berikut:
   - **Project URL** dan **anon / publishable key**: *Project Settings → API*
   - **service_role / secret key**: halaman yang sama. **RAHASIA**, jangan dibagikan ke siapa pun.
   - **Connection string**: *Connect* (tombol di atas) → **Session pooler** → salin, lalu ganti `[YOUR-PASSWORD]` dengan password database.
3. Matikan pendaftaran publik: *Authentication → Sign In / Providers →* matikan **Allow new users to sign up**, lalu **Save**.

## 2. Siapkan database dari laptopmu

Butuh Node.js 22 (https://nodejs.org).

```bash
git clone https://github.com/shanahmadmalikantara-dev/osis-evoting.git
cd osis-evoting
npm install
cp .env.example .env.local
```

Buka `.env.local`, isi 4 nilai dari langkah 1, lalu jalankan:

```bash
npm run setup
```

Perintah ini memasang tabel dan aturan keamanan, mengisi 4 paslon contoh, dan membuat 8 akun.
**Daftar email dan password hanya muncul SEKALI**, jadi langsung simpan dan cetak untuk panitia.

Untuk mencoba di laptop sendiri: `npm run dev`, lalu buka http://localhost:3000.

## 3. Vercel (hosting aplikasi)

1. Masuk ke https://vercel.com pakai akun GitHub.
2. Klik **Add New… → Project**, pilih repo `osis-evoting`, lalu klik **Import**.
3. Di **Environment Variables**, isi:

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (dipakai server untuk batas percobaan login) |
   | `AUTH_EMAIL_DOMAIN` | `pemilu-osis.local` (sama dengan di `.env.local`) |

   **Jangan** isi `DATABASE_URL` di Vercel, karena itu hanya untuk `npm run setup`.
4. Klik **Deploy**, lalu catat alamatnya (misalnya `https://osis-evoting.vercel.app`).
5. Di Supabase: *Authentication → URL Configuration → Site URL* isi dengan alamat Vercel tadi.

## 4. Uji keamanan sebelum hari-H

Selama status masih **Draft**, jalankan dari laptopmu:

```bash
APP_URL=https://osis-evoting.vercel.app npm run test:security
```

(Di Windows PowerShell: `$env:APP_URL="https://osis-evoting.vercel.app"; npm run test:security`)

Skrip ini membuat akun uji sementara, lalu mengecek semua aturan keamanan (bilik tidak bisa membaca suara, batas kirim, anti dobel, admin tidak bisa ubah atau hapus suara, simulasi 5 bilik). Semua dijalankan di dalam Mode Uji Coba, lalu dibersihkan lagi. Semua baris harus ✓.

## Mengubah tampilan

Semua warna, font, sudut, dan bayangan ada di bagian `@theme` file `src/app/globals.css`. Font diatur di `src/app/layout.tsx`.
Komponen yang paling sering diganti ada di `src/components/ui/` (Button, Sticker, Modal) dan `src/components/booth/CandidateCard.tsx`.
