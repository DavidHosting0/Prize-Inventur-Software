import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { routing } from "./i18n/routing";
import { RESERVED_PATH_SEGMENTS, hotelAppPath, localeAppPath } from "./lib/hotel-url";

const intlMiddleware = createMiddleware(routing);

function isPublicPath(pathname: string): boolean {
  // /de/login, /en/login, or /login after locale handling
  if (pathname.includes("/login")) return true;
  return false;
}

function isGroupPath(pathname: string): boolean {
  return pathname.includes("/group/");
}

/**
 * Public hotel URLs: /bern/de/dashboard
 * Internally rewritten to /de/dashboard with x-hotel-slug request header.
 * Auth + hotel binding enforced here (JWT only — no Prisma / Edge-safe).
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0]?.toLowerCase();
  const second = parts[1]?.toLowerCase();

  // Behind HTTPS reverse proxy, Auth.js sets `__Secure-authjs.session-token`.
  // Middleware must use secureCookie or getToken returns null → redirect loop.
  const useSecureCookie =
    process.env.NODE_ENV === "production" ||
    (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "").startsWith(
      "https://"
    );

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookie,
  });

  const accountType = (token?.accountType as string | undefined) ?? null;
  const hotelSlug = (token?.hotelSlug as string | null | undefined) ?? null;
  const hotelId = (token?.hotelId as string | null | undefined) ?? null;
  const isAuthed = Boolean(token?.sub || token?.id);

  // /{hotelSlug}/{locale}/...
  if (
    first &&
    second &&
    !RESERVED_PATH_SEGMENTS.has(first) &&
    (routing.locales as readonly string[]).includes(second)
  ) {
    const urlHotelSlug = first;
    const locale = second;
    const rest = parts.slice(2).join("/");
    const rewritePath = rest ? `/${locale}/${rest}` : `/${locale}`;

    if (!isAuthed) {
      return NextResponse.redirect(
        new URL(localeAppPath(locale, "/login"), request.url)
      );
    }

    if (accountType === "GROUP" && (!hotelId || hotelId === "")) {
      return NextResponse.redirect(
        new URL(localeAppPath(locale, "/group/dashboard"), request.url)
      );
    }

    // Bound hotel session must match URL slug
    if (hotelSlug && hotelSlug !== urlHotelSlug) {
      return NextResponse.redirect(
        new URL(hotelAppPath(hotelSlug, locale, "/dashboard"), request.url)
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = rewritePath;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-hotel-slug", urlHotelSlug);

    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  // Locale-first paths: /de/..., /en/...
  const localeCandidate = first;
  const isLocaleFirst =
    localeCandidate &&
    (routing.locales as readonly string[]).includes(localeCandidate);

  if (isLocaleFirst) {
    const locale = localeCandidate;
    const restPath = "/" + parts.slice(1).join("/");

    if (!isPublicPath(pathname) && !isAuthed) {
      return NextResponse.redirect(
        new URL(localeAppPath(locale, "/login"), request.url)
      );
    }

    // Hotel users hitting /de/dashboard without hotel prefix → send to hotel URL
    if (
      isAuthed &&
      hotelSlug &&
      !isPublicPath(pathname) &&
      !isGroupPath(pathname) &&
      restPath !== "/" &&
      !restPath.startsWith("/group")
    ) {
      // Allow group routes; for app routes without hotel slug, redirect
      const appRest = restPath === "" ? "/dashboard" : restPath;
      if (
        !appRest.startsWith("/login") &&
        !appRest.startsWith("/group")
      ) {
        return NextResponse.redirect(
          new URL(hotelAppPath(hotelSlug, locale, appRest), request.url)
        );
      }
    }

    if (
      isAuthed &&
      accountType === "GROUP" &&
      (!hotelId || hotelId === "") &&
      !isGroupPath(pathname) &&
      !isPublicPath(pathname)
    ) {
      return NextResponse.redirect(
        new URL(localeAppPath(locale, "/group/dashboard"), request.url)
      );
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
