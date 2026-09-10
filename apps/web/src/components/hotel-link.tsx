"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";

type HotelLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Client Link that prefixes the active hotel slug when present. */
export function HotelLink({ href, prefetch = true, ...props }: HotelLinkProps) {
  const { data: session } = useSession();
  const locale = useLocale();
  const slug = session?.user?.hotelSlug;
  const resolved = slug
    ? hotelAppPath(slug, locale, href)
    : localeAppPath(locale, href);

  return <Link href={resolved} prefetch={prefetch} {...props} />;
}
