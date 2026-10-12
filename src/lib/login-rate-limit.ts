import "server-only";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service";

// Per account: stops password guessing on one account.
export const MAX_FAILED_PER_ACCOUNT = 5;
// Per IP: higher, because all school laptops may share one public IP.
export const MAX_FAILED_PER_IP = 30;
export const WINDOW_SECONDS = 15 * 60;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type RateLimitKeys = { emailKey: string; ipKey: string | null };

export function rateLimitKeys(email: string, ip: string | null): RateLimitKeys {
  return {
    emailKey: hash(`email:${email.toLowerCase()}`),
    ipKey: ip ? hash(`ip:${ip}`) : null,
  };
}

const allKeys = (keys: RateLimitKeys) => (keys.ipKey ? [keys.emailKey, keys.ipKey] : [keys.emailKey]);

async function blocked(keys: string[], max: number): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc("login_is_blocked", {
    p_keys: keys,
    p_max: max,
    p_window_seconds: WINDOW_SECONDS,
  });
  // Fail closed: if we cannot check, do not allow unlimited guessing.
  if (error) throw new Error(`login rate-limit check failed: ${error.message}`);
  return data === true;
}

export async function isLoginBlocked(keys: RateLimitKeys): Promise<boolean> {
  if (await blocked([keys.emailKey], MAX_FAILED_PER_ACCOUNT)) return true;
  return keys.ipKey ? blocked([keys.ipKey], MAX_FAILED_PER_IP) : false;
}

export async function recordLoginFailure(keys: RateLimitKeys): Promise<void> {
  await getServiceClient().rpc("login_record_failure", { p_keys: allKeys(keys) });
}

export async function clearAccountFailures(keys: RateLimitKeys): Promise<void> {
  await getServiceClient().rpc("login_clear", { p_keys: [keys.emailKey] });
}
