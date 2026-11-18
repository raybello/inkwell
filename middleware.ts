import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/app");
  const isAuthPage = pathname.startsWith("/auth");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user && !pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // The middleware's job is session refresh + auth redirects, which only
  // matter on surfaces that have a session at all. Everything else is matched
  // out on purpose:
  //  - /api/* routes build their own Supabase client (session auth) or verify
  //    an API key / Stripe signature (service-role auth) inside the handler;
  //  - public pages (marketing, /share, /docs) never need a session check —
  //    `app/app/layout.tsx` runs `requireUser()` server-side, so /app stays
  //    guarded even if this matcher is narrowed further.
  // The old catch-all matcher ran a Supabase auth.getUser() round-trip in
  // front of every request, doubling auth work for API-key routes and adding
  // latency to Stripe webhooks and public share reads.
  matcher: ["/app/:path*", "/auth/:path*"],
};
