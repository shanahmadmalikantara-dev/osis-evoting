# Panduan Pasang Pemilu MPK (Supabase + Vercel baru)

Website MPK **terpisah** dari website OSIS: database sendiri dan alamat sendiri. Cukup dilakukan sekali. Semua gratis.

## 1. Supabase baru (database + login)

1. Masuk ke https://supabase.com, klik **New project**.
   - Name: `pemilu-mpk`
   - Database password: buat yang kuat, lalu **simpan**
   - Region: **Southeast Asia (Singapore)**
2. Setelah proyek siap, catat 4 nilai:
   - **Project URL** dan **anon / publishable key**: *Project Settings → API*
   - **service_role / secret key**: halaman yang sama. **RAHASIA**, jangan dikirim ke siapa pun (termasuk ke chat).
   - **Connection string**: tombol *Connect* → **Session pooler** → salin, lalu ganti `[YOUR-PASSWORD]` dengan password database.
3. Matikan pendaftaran publik: *Authentication → Sign In / Providers →* matikan **Allow new users to sign up**, lalu **Save**.

> Akun Supabase gratis boleh punya 2 proyek aktif, jadi proyek OSIS dan MPK bisa jalan bersamaan.

## 2. Siapkan database dari laptopmu

```bash
git pull                     # ambil versi terbaru repo osis-evoting
cd mpk-evoting
npm install
cp .env.example .env.local
```

Buka `mpk-evoting/.env.local`, isi 4 nilai dari langkah 1, lalu:

```bash
npm run setup
```

Ini memasang tabel dan aturan keamanan, mengisi 2 paslon contoh dan 12 nama pemilih contoh, dan membuat akun `admin`.
**Password admin hanya muncul SEKALI**, langsung simpan.

## 3. Vercel baru (alamat website)

1. Di https://vercel.com klik **Add New… → Project**, pilih repo `osis-evoting` lagi, lalu **Import**.
2. **Project Name**: misalnya `pemilu-mpk`.
3. **Root Directory**: klik **Edit**, pilih folder **`mpk-evoting`**. (Ini yang membuatnya jadi website terpisah.)
4. **Environment Variables**:

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (MPK) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key (MPK) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (MPK) |
   | `AUTH_EMAIL_DOMAIN` | `pemilu-mpk.local` |

   **Jangan** isi `DATABASE_URL` di Vercel.
5. Klik **Deploy**, catat alamatnya (misalnya `https://pemilu-mpk.vercel.app`).
6. Di Supabase MPK: *Authentication → URL Configuration → Site URL* isi dengan alamat tadi.

## 4. Uji keamanan sebelum hari-H

Selama status masih **Draft**, dari folder `mpk-evoting`:

```bash
APP_URL=https://pemilu-mpk.vercel.app npm run test:security
```

(Windows PowerShell: `$env:APP_URL="https://pemilu-mpk.vercel.app"; npm run test:security`)

Semua baris harus ✓. Data uji dibersihkan otomatis.
