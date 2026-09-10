import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
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
      <header className="login-topbar">
        <div className="login-topbar-brand">
          <span className="login-topbar-name">{t("brandName")}</span>
          <span className="login-topbar-sep" aria-hidden>
            |
          </span>
          <span className="login-topbar-tag">{t("brandTag")}</span>
        </div>
        <div className="login-topbar-meta">
          <span>{t("panelEyebrow")}</span>
          <span className="login-topbar-locale">{locale.toUpperCase()}</span>
        </div>
      </header>

      <main className="login-workspace">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>

      <footer className="login-statusbar">
        <span>{t("panelFooter")}</span>
        <span>{t("systemLine")}</span>
      </footer>
    </div>
  );
}
