// The MPK app has a single account role. Voters do not log in: they pick their name from the roster.
export type AppRole = "admin";

export function roleFromClaims(claims: unknown): AppRole | null {
  const role = (claims as { app_metadata?: { role?: unknown } } | null)?.app_metadata?.role;
  return role === "admin" ? role : null;
}

export const HOME_FOR_ROLE: Record<AppRole, string> = {
  admin: "/admin",
};

export const LOGIN_FOR_ROLE: Record<AppRole, string> = {
  admin: "/admin/login",
};
