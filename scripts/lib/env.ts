// Reads required env vars for local scripts, with messages a non-technical user can act on.
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\n✗ ${name} belum diisi di .env.local. Lihat .env.example untuk contohnya.\n`);
    process.exit(1);
  }
  return value;
}
