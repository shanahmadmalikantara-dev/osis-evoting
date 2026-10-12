// Indonesian messages for errors raised by the admin database functions.
const ADMIN_ERROR_TEXT: Record<string, string> = {
  not_admin: "Akun ini bukan admin.",
  invalid_transition: "Langkah ini tidak bisa dilakukan pada status sekarang. Muat ulang halaman.",
  no_candidates: "Belum ada paslon. Tambahkan paslon dulu.",
  votes_not_empty: "Masih ada suara tersimpan. Akhiri uji coba dulu.",
  candidates_locked: "Paslon hanya bisa diubah saat status draft.",
};

export function adminErrorText(message: string | undefined): string {
  for (const [key, text] of Object.entries(ADMIN_ERROR_TEXT)) {
    if (message?.includes(key)) return text;
  }
  return "Terjadi kesalahan. Coba lagi.";
}
