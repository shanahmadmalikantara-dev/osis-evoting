# Panduan Hari-H Pemilu OSIS

Panduan singkat untuk panitia dan pembina. Tidak perlu paham coding.
Alamat aplikasi di bawah ditulis `ALAMAT` (contoh: `https://pemilu-osis.vercel.app`).

---

## H-1: Sehari sebelum pemilihan

### 1. Cek Supabase masih aktif
Proyek Supabase gratis **otomatis dijeda kalau 7 hari tidak dipakai**. Buka supabase.com, masuk ke proyek, dan pastikan statusnya tidak "Paused". Kalau dijeda, klik **Restore** lalu tunggu sampai aktif.

### 2. Cek paslon
Login admin di `ALAMAT/admin/login`, buka menu **Paslon**, lalu pastikan nama, nomor urut, dan foto sudah benar. Paslon **terkunci** begitu voting dibuka.

### 3. Siapkan 8 laptop bilik
Lakukan di **setiap** laptop:

1. Colokkan charger. Matikan mode tidur: *Settings → System → Power → Sleep: Never*.
2. Sambungkan ke Wi-Fi sekolah. Simpan juga hotspot HP cadangan.
3. Buka Google Chrome **biasa** (bukan mode incognito), buka `ALAMAT/bilik/login`.
4. Login dengan akun bilik laptop itu (`bilik1` untuk laptop 1, `bilik2` untuk laptop 2, dan seterusnya). Tempel kertas "BILIK 1", "BILIK 2", dan seterusnya di laptop.
5. Tutup Chrome.
6. Buat shortcut kiosk di desktop: klik kanan desktop → *New → Shortcut*, lalu isi:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk ALAMAT/bilik
   ```
   Beri nama **"BILIK SUARA"**.
7. Buka shortcut itu. Layar penuh harus menampilkan **"BELUM DIBUKA"**.
   - Kalau malah muncul halaman login, ulangi langkah 3–5.
   - Untuk keluar dari mode kiosk, tekan **Alt + F4**.

Login bilik bertahan berhari-hari, jadi tidak perlu login ulang besok pagi.

### 4. Uji coba (wajib)
1. Di laptop admin, buka **Dashboard** lalu klik **Mulai uji coba**.
2. Di setiap laptop bilik, layar akan berubah menjadi kartu paslon dengan pita pink **"MODE UJI COBA"**. Pilih satu paslon, lalu klik **Ya, kirim**. Harus muncul **"TERIMA KASIH"**.
3. Di dashboard, angka **Per bilik** untuk setiap bilik harus bertambah 1.
4. Klik **Akhiri uji coba**. Semua suara uji dibersihkan dan status kembali **Draft**. Ini satu-satunya cara aman menghapus data uji. Suara sungguhan tidak bisa dihapus selama voting berjalan.

---

## Hari-H

### Membuka voting
1. Pastikan dashboard berstatus **Draft** dengan total **0**.
2. Klik **Buka voting**, baca peringatannya, lalu klik **Ya, buka voting**.
3. Kedelapan bilik otomatis menampilkan kartu paslon dalam beberapa detik.

> Setelah dibuka, voting **tidak bisa** dikembalikan ke draft dan suara **tidak bisa** dihapus sampai voting ditutup. Itu disengaja demi keamanan.

### Selama voting
- Petugas memverifikasi pemilih **di luar aplikasi** (daftar hadir), lalu mempersilakan masuk ke bilik.
- Pemilih mengetuk kartu paslon, menekan **Ya, kirim**, dan menunggu tulisan **"TERIMA KASIH"**. Setelah 4 detik, layar kembali ke kartu paslon untuk pemilih berikutnya.
- Kalau pemilih ragu, tombol **Batal** aman ditekan. Dialog juga batal sendiri setelah 60 detik.
- Pantau dashboard: total dan angka per bilik naik secara live.
- **Taruh layar dashboard jauh dari bilik dan antrean**, supaya angka yang naik tidak bisa dicocokkan dengan orang yang baru keluar bilik.

### Menutup voting
1. Setelah antrean habis, klik **Tutup voting**, lalu **Ya, tutup voting**. Langkah ini **FINAL**.
2. Semua bilik menampilkan **"SUDAH DITUTUP"**.

### Ekspor hasil
Di dashboard, bagian **Ekspor hasil**:
- **CSV (Excel)** untuk diolah.
- **PDF** untuk dicetak. Ada kolom tanda tangan 3 saksi/pembina.

File yang diekspor setelah voting ditutup diberi nama `...-AKHIR`. Kalau diekspor sebelum ditutup, namanya `...-SEMENTARA`. Setiap ekspor tercatat di **Audit log**.

### Menghapus data setelah selesai (opsional)
Lakukan **hanya** setelah hasil diumumkan dan file CSV + PDF sudah disimpan dan ditandatangani.
1. Di dashboard (status **Ditutup**), klik **Hapus semua suara** di kotak bergaris merah paling bawah.
2. Ketik persis `HAPUS SEMUA SUARA`, lalu klik **Hapus permanen**.
3. Semua suara hilang permanen dan status kembali **Draft**. Paslon dan akun tidak berubah. Kejadian ini tercatat di **Audit log**.

Tombol ini tidak muncul saat draft, uji coba, atau voting dibuka.

---

## Kalau ada masalah

| Masalah | Yang dilakukan |
|---|---|
| Muncul kotak merah "Suara belum terkirim… koneksi bermasalah" | Minta pemilih **tetap di bilik** lalu tekan **Coba lagi**. Tombol ini aman ditekan berkali-kali karena suara tidak akan tercatat dobel. **Jangan muat ulang halaman** selama kotak merah masih ada. |
| Internet sekolah mati | Sambungkan laptop ke hotspot HP cadangan, lalu tekan **Coba lagi**. Antrean menunggu sampai internet kembali. |
| "Bilik ini baru saja mengirim suara. Tunggu beberapa detik" | Tunggu 8 detik lalu tekan **Coba lagi**. Ini pengaman anti klik beruntun. |
| "Sesi laptop bilik habis" | Tekan Alt + F4, buka Chrome biasa, login ulang akun bilik itu, lalu buka lagi shortcut **BILIK SUARA**. |
| Laptop mati atau hang | Arahkan antrean ke bilik lain. Laptop yang sudah menyala lagi cukup dibuka lewat shortcut **BILIK SUARA**. |
| Laptop harus dimatikan saat masih ada kotak merah | Sebelum dimatikan, catat angka bilik itu di dashboard. Setelah laptop menyala lagi, kalau angkanya **sudah bertambah 1**, suara pemilih tadi sudah masuk. Kalau **belum**, pemilih boleh memilih ulang. |
| Layar bilik "GAGAL MEMUAT" | Periksa internet, lalu tekan **Muat ulang**. |
| Dashboard menulis "Koneksi terputus" | Angka tetap aman di database. Periksa internet laptop admin, nanti angkanya menyusul otomatis. |
| Lupa password akun | Dari laptop yang punya `.env.local`, jalankan `npm run reset-password -- admin` (atau nama akun bilik, misalnya `bilik3`). Password baru tampil sekali. |
