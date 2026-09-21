"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LayoutDashboard, LogOut, Banknote } from "lucide-react";

/** Full-screen POS chrome — light terminal. */
export function PosTerminalShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("pos");
  const ta = useTranslations("auth");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = new Intl.DateTimeFormat(locale === "de" ? "de-CH" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
  const date = new Intl.DateTimeFormat(locale === "de" ? "de-CH" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(now);

  const hotelName =
    session?.user?.hotelName?.trim() ||
    (session?.user?.hotelSlug
      ? session.user.hotelSlug.charAt(0).toUpperCase() +
        session.user.hotelSlug.slice(1)
      : "");

  return (
    <div
      data-theme="light"
      data-pos-terminal
      className="pos-terminal flex h-screen flex-col overflow-hidden text-[var(--text)]"
    >
      <header className="pos-terminal-header shrink-0">
        <div className="pos-terminal-brand">
          <Image
            src="/icons/favicon-32.png"
            alt=""
            width={28}
            height={28}
            className="pos-terminal-logo"
            priority
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="pos-terminal-brand-name">{hotelName}</span>
              <span className="pos-terminal-badge">{t("title")}</span>
            </div>
            {title ? (
              <div className="pos-terminal-subtitle truncate">{title}</div>
            ) : null}
          </div>
        </div>

        <div className="pos-terminal-clock hidden tablet:block">
          <div className="pos-terminal-time">{time}</div>
          <div className="pos-terminal-date">{date}</div>
        </div>

        <div className="pos-terminal-actions">
          <div className="pos-terminal-session hidden desktop:block">
            <div className="pos-terminal-hotel truncate">
              {session?.user?.name}
            </div>
            <div className="pos-terminal-user truncate">
              {session?.user?.roleCode}
            </div>
          </div>

          <Link href="/pos/cash-close" className="pos-terminal-header-btn">
            <Banknote className="h-4 w-4" />
            <span className="hidden tablet:inline">{t("cashClose")}</span>
          </Link>
          <Link
            href="/dashboard"
            className="pos-terminal-header-btn"
            title={t("backToOffice")}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden desktop:inline">{t("backToOffice")}</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
            className="pos-terminal-header-btn pos-terminal-header-btn-danger"
            title={ta("signOut")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="pos-terminal-main min-h-0 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
