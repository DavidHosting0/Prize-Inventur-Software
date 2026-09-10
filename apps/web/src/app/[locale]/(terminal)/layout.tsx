import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";
import { assertHotelAccess } from "@/lib/tenant";
import type { SessionUser } from "@/lib/rbac";
import { isNextResponse } from "@/lib/api";

/** Auth gate for the POS terminal (separate UI from office/admin). */
export default async function TerminalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`${localeAppPath(locale, "/login")}?next=${encodeURIComponent(localeAppPath(locale, "/pos"))}`);
  }
  if (
    session.user.accountType === "GROUP" &&
    (session.user.hotelId === null || session.user.hotelId === "")
  ) {
    redirect(localeAppPath(locale, "/group/dashboard"));
  }

  const h = await headers();
  const urlSlug = h.get("x-hotel-slug");

  if (session.user.hotelId && !urlSlug) {
    if (session.user.hotelSlug) {
      redirect(hotelAppPath(session.user.hotelSlug, locale, "/pos"));
    }
  }

  if (urlSlug) {
    const hotel = await prisma.hotel.findUnique({
      where: { slug: urlSlug },
      select: { id: true, slug: true, organizationId: true },
    });

    if (!hotel || hotel.organizationId !== session.user.organizationId) {
      if (session.user.hotelSlug) {
        redirect(hotelAppPath(session.user.hotelSlug, locale, "/pos"));
      }
      redirect(localeAppPath(locale, "/group/dashboard"));
    }

    if (session.user.accountType === "HOTEL") {
      if (session.user.hotelId !== hotel.id) {
        redirect(
          hotelAppPath(session.user.hotelSlug ?? hotel.slug, locale, "/pos")
        );
      }
    } else {
      try {
        await assertHotelAccess(session.user as SessionUser, hotel.id);
      } catch (e) {
        if (isNextResponse(e) || e instanceof Error) {
          redirect(localeAppPath(locale, "/group/dashboard"));
        }
        throw e;
      }
      if (
        session.user.hotelId &&
        session.user.hotelId !== hotel.id &&
        session.user.hotelSlug
      ) {
        redirect(hotelAppPath(session.user.hotelSlug, locale, "/pos"));
      }
    }
  }

  return children;
}
