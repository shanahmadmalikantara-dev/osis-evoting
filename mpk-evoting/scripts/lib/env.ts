// Reads required env vars for local scripts, with messages a non-technical user can act on.
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\n✗ ${name} belum diisi di .env.local. Lihat .env.example untuk contohnya.\n`);
    process.exit(1);
  }
  return value;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// Checks DATABASE_URL and fixes the most common mistake: a password with symbols (@ # / ? : %)
// that is not URL-encoded. Returns a connection string that `pg` can parse.
export function databaseUrlFromEnv(): string {
  const raw = requireEnv("DATABASE_URL");
  if (/\s/.test(raw)) fail("DATABASE_URL berisi spasi atau terpotong jadi dua baris. Tulis dalam satu baris tanpa spasi.");
  if (raw.includes("[") || raw.includes("]")) {
    fail("DATABASE_URL masih berisi tanda [ ]. Ganti [YOUR-PASSWORD] dengan password database, kurung sikunya ikut dihapus.");
  }
  const match = raw.match(/^(postgres(?:ql)?:\/\/)([^:/@]+):(.*)@([^@]+)$/);
  if (!match) {
    fail(
      "DATABASE_URL bentuknya tidak dikenali atau terpotong. Kalau password ada tanda #, apit nilainya dengan tanda kutip: " +
        'DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-...pooler.supabase.com:5432/postgres"',
    );
  }
  const [, scheme, user, password, rest] = match;
  const alreadyEncoded = /%[0-9A-Fa-f]{2}/.test(password) && !/[@#/?:]/.test(password);
  const url = `${scheme}${user}:${alreadyEncoded ? password : encodeURIComponent(password)}@${rest}`;
  try {
    new URL(url);
  } catch {
    fail("DATABASE_URL tidak valid. Coba reset password database (huruf + angka saja) lalu salin ulang connection string-nya.");
  }
  return url;
}

export function supabaseUrlFromEnv(): string {
  const raw = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+$/.test(raw)) {
    fail("NEXT_PUBLIC_SUPABASE_URL tidak valid. Harus seperti: https://xxxx.supabase.co (tanpa /rest/v1 di belakang).");
  }
  return raw;
}
