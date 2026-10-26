# Panduan Hari-H Pemilu MPK

Untuk panitia dan pengawas. Alamat website ditulis `ALAMAT` (contoh: `https://pemilu-mpk.vercel.app`).

---

## Sebelum hari-H

### 1. Isi daftar pemilih asli
1. Siapkan Excel dengan 3 kolom: **Nama**, **Kelas**, **Perwakilan** (isi perwakilan dengan: `Ketua Eskul`, `Perwakilan Kelas`, `OSIS/MPK 2025/2026`, atau `Calon OSIS/MPK 2026/2027`).
2. Login admin di `ALAMAT/admin/login`, buka menu **Pemilih**.
3. Klik **Kosongkan daftar** untuk membuang 12 nama contoh.
4. Blok semua isi Excel (boleh dengan judul kolomnya), **Ctrl + C**, lalu tempel di kotak **Tempel di sini**.
5. Cek ringkasannya ("... nama siap ditambahkan"). Kalau ada baris merah, perbaiki di Excel lalu tempel ulang.
6. Klik **Tambahkan ... nama**. Nama yang sama dengan kelas yang sama otomatis dilewati, jadi orang yang masuk 2 perwakilan tetap 1 suara.

Nama yang salah ketik bisa dihapus (tombol **Hapus**) lalu ditambah lagi, selama orang itu belum memilih.

### 2. Cek paslon
Menu **Paslon**: pastikan nama, nomor urut, dan foto benar. Paslon terkunci begitu voting dibuka.

### 3. Cek Supabase masih aktif
Proyek gratis otomatis dijeda kalau 7 hari tidak dipakai. Buka supabase.com, pastikan proyek MPK tidak "Paused".

### 4. Uji coba (wajib)
1. Dashboard → **Mulai uji coba**.
2. Dari 1–2 HP, buka `ALAMAT/pilih`, pilih perwakilan, kelas, nama, lalu paslon. Harus muncul **"TERIMA KASIH"**.
3. Di dashboard angkanya naik, dan di menu **Pemilih** nama itu tertulis "Memilih paslon ...".
4. Klik **Akhiri uji coba**. Suara uji hilang, nama kembali "Belum memilih", dan HP tadi bisa dipakai lagi.

---

## Hari-H

### Membuka voting
1. Pastikan status **Draft** dan total **0**.
2. Klik **Buka voting** → **Ya, buka voting**.
3. Bagikan alamat `ALAMAT/pilih` (misalnya lewat QR code di papan atau grup WA). Halaman di HP yang sudah terbuka akan berubah sendiri dalam ±10 detik.

### Selama voting
- Pemilih memakai **HP masing-masing**: pilih perwakilan → kelas → nama sendiri → paslon → **Ya, kirim**.
- Setelah memilih, HP itu tetap di layar **"TERIMA KASIH"** dan namanya tercoret untuk semua orang.
- Pengawas memastikan setiap orang memilih **namanya sendiri**.
- Pantau menu **Pemilih**: filter "Belum memilih" untuk melihat siapa yang belum.

### Kalau ada salah nama atau nama dobel
1. Menu **Pemilih**, cari nama itu.
2. Klik **Batalkan suara** → **Ya, batalkan**. Suaranya hilang dari hitungan dan namanya bisa dipilih lagi. Tercatat di **Audit log**.
3. Orang yang benar memilih ulang. Kalau dia memakai HP yang tadi, muat ulang halamannya dulu.

### Menutup voting
1. Klik **Tutup voting** → **Ya, tutup voting**. Langkah ini **FINAL**.
2. **Ekspor hasil**: **CSV** berisi angka + daftar siapa memilih apa; **PDF** berisi angka saja dengan kolom tanda tangan.

### Menghapus data setelah selesai (opsional)
Setelah hasil diumumkan dan file sudah disimpan: dashboard → **Hapus semua suara** → ketik `HAPUS SEMUA SUARA`. Daftar pemilih tetap ada.

---

## Kalau ada masalah

| Masalah | Yang dilakukan |
|---|---|
| "Suara belum terkirim… koneksi bermasalah" | Tekan **Coba lagi**. Aman ditekan berkali-kali, suara tidak akan dobel. Kalau sinyal HP jelek, pindah ke Wi-Fi sekolah. |
| "Nama ini sudah dipakai untuk memilih" | Ada yang sudah memilih dengan nama itu. Lapor pengawas; admin cek di menu **Pemilih** dan batalkan kalau memang salah. |
| Nama tidak ada di daftar | Admin tambahkan di menu **Pemilih** (tempel 1 baris), lalu pemilih muat ulang halaman. |
| HP pemilih tidak bisa dipakai (baterai/kuota habis) | Boleh pinjam HP lain yang **belum** dipakai memilih, atau HP pengawas dengan jendela **Incognito/Private** (tutup jendela itu setelahnya). |
| Layar "GAGAL MEMUAT" | Cek internet, tekan **Muat ulang**. |
| Lupa password admin | Dari laptop yang punya `mpk-evoting/.env.local`: `npm run reset-password -- admin`. |
