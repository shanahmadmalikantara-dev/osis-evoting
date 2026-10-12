import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

let client: SupabaseClient | undefined;

export function getBrowserClient(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

// Realtime must carry the user's token, otherwise RLS hides every row change.
// Call this before subscribing to postgres_changes.
export async function authorizeRealtime() {
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
  return supabase;
}
