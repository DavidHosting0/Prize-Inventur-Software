import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";
import { ClipboardList, Package, Store } from "lucide-react";

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

  const capabilities = [
    {
      icon: Package,
      title: t("capabilityInventory"),
      hint: t("capabilityInventoryHint"),
    },
    {
      icon: Store,
      title: t("capabilityPos"),
      hint: t("capabilityPosHint"),
    },
    {
      icon: ClipboardList,
      title: t("capabilityOps"),
      hint: t("capabilityOpsHint"),
    },
  ] as const;

  return (
    <div className="login-shell">
      <aside className="login-brand" aria-label={t("brandName")}>
        <div className="login-brand-skyline" aria-hidden />
        <div className="login-brand-inner">
          <div className="login-brand-top">
            <p className="login-brand-eyebrow">{t("panelEyebrow")}</p>
            <h1 className="login-brand-name">{t("brandName")}</h1>
            <p className="login-brand-tag">{t("brandTag")}</p>
          </div>

          <div className="login-brand-copy">
            <h2 className="login-brand-headline">{t("panelHeadline")}</h2>
            <p className="login-brand-body">{t("panelBody")}</p>
          </div>

          <ul className="login-capabilities">
            {capabilities.map(({ icon: Icon, title, hint }) => (
              <li key={title} className="login-capability">
                <span className="login-capability-icon">
                  <Icon size={18} strokeWidth={2} aria-hidden />
                </span>
                <span>
                  <span className="login-capability-title">{title}</span>
                  <span className="login-capability-hint">{hint}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="login-brand-footer">{t("panelFooter")}</p>
        </div>
      </aside>

      <main className="login-main">
        <div className="login-main-frame">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
