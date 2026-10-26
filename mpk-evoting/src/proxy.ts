import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { HOME_FOR_ROLE, LOGIN_FOR_ROLE, roleFromClaims, type AppRole } from "@/lib/roles";

// Refreshes the Supabase session cookie on every request and blocks wrong roles early.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const role = roleFromClaims(data?.claims);
  const { pathname } = request.nextUrl;

  const area: AppRole | null = pathname.startsWith("/admin") ? "admin" : null;
  if (!area) return response;

  const isLoginPage = pathname === LOGIN_FOR_ROLE[area];

  if (isLoginPage) {
    // Already logged in with the right role: skip the login form.
    if (role === area) return redirectKeepingCookies(request, response, HOME_FOR_ROLE[area]);
    return response;
  }

  if (!role) return redirectKeepingCookies(request, response, LOGIN_FOR_ROLE[area]);

  if (role !== area) {
    const denied = NextResponse.rewrite(new URL("/akses-ditolak", request.url), { status: 403 });
    for (const cookie of response.cookies.getAll()) denied.cookies.set(cookie);
    return denied;
  }

  return response;
}

function redirectKeepingCookies(request: NextRequest, response: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|dummy/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
