/**
 * Next.js Root Middleware
 *
 * Responsibilities:
 * 1. Refresh expired auth tokens (via updateSession)
 * 2. Protect private routes (redirect to /login if unauthenticated)
 * 3. Protect admin routes (redirect to /forbidden if not ADMIN/SUPER_ADMIN)
 * 4. Redirect authenticated users away from auth pages
 * 5. Set security headers
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getLocaleFromHeader } from "@/lib/i18n/getLocale";

const LOCALE_COOKIE = "locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Detect the user's preferred language on first visit and persist it
 * in the "locale" cookie. Only runs when the cookie is absent, so it
 * never overrides an explicit user choice from the EN/ES switcher.
 */
function ensureLocaleCookie(request: NextRequest, response: NextResponse): void {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing) return;

  const detected = getLocaleFromHeader(request.headers.get("accept-language"));
  response.cookies.set(LOCALE_COOKIE, detected, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

// ── Route Classification ─────────────────────────────────────────────────────

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/beta",
  "/onboarding",
  "/forbidden",
  // Legal pages — publicly accessible without authentication.
  "/privacy",
  "/terms",
  "/cookies",
]);

const AUTH_ROUTES = new Set(["/login", "/register", "/forgot-password"]);

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/auth/");
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes (they handle their own auth)
  if (isApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Refresh session and get user
  const { user, supabaseResponse } = await updateSession(request);

  // Set security headers on all responses
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  // Detect and persist the locale on first visit (does not override user choice)
  ensureLocaleCookie(request, supabaseResponse);

  // ── Public routes: allow through ───────────────────────────────────────────
  if (isPublicRoute(pathname)) {
    // If user is authenticated and visiting auth pages, redirect to dashboard
    if (user && isAuthRoute(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ── Protected routes: require authentication ───────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // ── Admin routes: require ADMIN or SUPER_ADMIN role ────────────────────────
  if (isAdminRoute(pathname)) {
    // Query the user's role from the database
    // We use a lightweight fetch to avoid importing the full Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const roleResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=role`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const roleData = await roleResponse.json();
    const role = roleData?.[0]?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      const url = request.nextUrl.clone();
      url.pathname = "/forbidden";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

// ── Matcher: exclude static files and images ─────────────────────────────────

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
