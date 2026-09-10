/** Build public hotel-scoped paths: /bern/de/dashboard */
export function hotelAppPath(
  hotelSlug: string,
  locale: string,
  path: string = "/dashboard"
): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${hotelSlug}/${locale}${clean}`;
}

/** Group / auth paths stay locale-first: /de/group/dashboard */
export function localeAppPath(locale: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

export function slugifyHotelName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "hotel";
}

export const RESERVED_PATH_SEGMENTS = new Set([
  "api",
  "_next",
  "de",
  "en",
  "login",
  "group",
  "favicon.ico",
]);
