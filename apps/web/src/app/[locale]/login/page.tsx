import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import Image from "next/image";
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
  const t = await getTranslations("auth");
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
    <div className="login-shell">
      <aside className="login-hero" aria-label={t("heroTitle")}>
        <Image
          src="/hotels/login-hero.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
          className="login-hero-image"
        />
        <div className="login-hero-scrim" aria-hidden />
        <div className="login-hero-content">
          <div className="login-hero-logo">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={40}
              height={40}
              className="login-hero-logo-mark"
              priority
            />
            <span>{t("panelEyebrow")}</span>
          </div>
          <div className="login-hero-copy">
            <h1 className="login-hero-title">{t("heroTitle")}</h1>
            <p className="login-hero-subtitle">{t("heroSubtitle")}</p>
          </div>
          <p className="login-hero-footer">{t("panelFooter")}</p>
        </div>
      </aside>

      <main className="login-pane">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
