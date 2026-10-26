export type AppRole = "admin" | "bilik";

export function roleFromClaims(claims: unknown): AppRole | null {
  const role = (claims as { app_metadata?: { role?: unknown } } | null)?.app_metadata?.role;
  return role === "admin" || role === "bilik" ? role : null;
}

export const HOME_FOR_ROLE: Record<AppRole, string> = {
  admin: "/admin",
  bilik: "/bilik",
};

export const LOGIN_FOR_ROLE: Record<AppRole, string> = {
  admin: "/admin/login",
  bilik: "/bilik/login",
};
