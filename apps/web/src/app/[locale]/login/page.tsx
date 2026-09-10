import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user?.id) {
    if (next?.startsWith("/")) {
      redirect(next);
    }
    if (session.user.accountType === "GROUP" && !session.user.hotelId) {
      redirect(localeAppPath(locale, "/group/dashboard"));
    }
    if (session.user.hotelSlug) {
      const path = session.user.roleCode === "BAR" ? "/pos" : "/dashboard";
      redirect(hotelAppPath(session.user.hotelSlug, locale, path));
    }
    redirect(
      localeAppPath(
        locale,
        session.user.accountType === "GROUP" ? "/group/dashboard" : "/dashboard"
      )
    );
  }

  return (
    <div className="app-canvas relative flex min-h-screen items-center justify-center p-4">
      <div className="relative z-10 flex w-full justify-center">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
