import { DOMAIN, E2E_USERS, PASSWORD, assertLocal, serviceClient, withDb } from "./fixtures";

export default async function globalSetup() {
  process.loadEnvFile?.(".env.local");
  assertLocal();
  const supabase = serviceClient();
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  for (const user of Object.values(E2E_USERS)) {
    const email = `${user.username}@${DOMAIN}`;
    const existing = data.users.find((u) => u.email === email);
    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, { password: PASSWORD, app_metadata: { role: user.role } });
    } else {
      const { error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { role: user.role },
      });
      if (error) throw error;
    }
  }

  await withDb((db) => db.query("delete from public.login_attempts"));
}
