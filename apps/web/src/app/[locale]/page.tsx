import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) {
    redirect(localeAppPath(locale, "/login"));
  }
  if (session.user.accountType === "GROUP" && !session.user.hotelId) {
    redirect(localeAppPath(locale, "/group/dashboard"));
  }
  if (session.user.hotelSlug) {
    const path = session.user.roleCode === "BAR" ? "/pos" : "/dashboard";
    redirect(hotelAppPath(session.user.hotelSlug, locale, path));
  }
  redirect(localeAppPath(locale, "/dashboard"));
}
