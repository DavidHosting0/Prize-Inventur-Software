"use client";

import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@prize/ui";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";
import { BrandMark } from "./brand-mark";
import { Lock, ShieldCheck } from "lucide-react";

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@demo-hotel.ch");
  const [password, setPassword] = useState("Demo123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function safeNextPath(): string | null {
    const raw = searchParams.get("next");
    if (!raw) return null;
    try {
      const url = new URL(raw, "http://local");
      const path = url.pathname;
      if (path.startsWith("/")) return path;
    } catch {
      /* ignore */
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(t("invalidCredentials"));
      return;
    }

    const explicitNext = safeNextPath();
    if (explicitNext) {
      window.location.href = explicitNext;
      return;
    }

    try {
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      if (session?.user?.accountType === "GROUP" && !session?.user?.hotelId) {
        window.location.href = localeAppPath(locale, "/group/dashboard");
        return;
      }
      const slug = session?.user?.hotelSlug as string | null | undefined;
      if (slug) {
        const path =
          session?.user?.roleCode === "BAR" ? "/pos" : "/dashboard";
        window.location.href = hotelAppPath(slug, locale, path);
        return;
      }
      if (session?.user?.accountType === "GROUP") {
        window.location.href = localeAppPath(locale, "/group/dashboard");
        return;
      }
    } catch {
      /* fall through to default */
    }
    window.location.href = localeAppPath(locale, "/dashboard");
  }

  return (
    <div className="login-panel">
      <header className="login-panel-header">
        <BrandMark
          name={t("brandName")}
          tag={t("brandTag")}
          className="sidebar-brand !h-auto !min-h-0 !border-0 !bg-transparent !p-0"
        />
        <div className="login-panel-meta">
          <span className="login-access-badge">
            <ShieldCheck size={13} strokeWidth={2.25} aria-hidden />
            {t("accessLabel")}
          </span>
          <span className="login-locale">{locale.toUpperCase()}</span>
        </div>
      </header>

      <div className="login-panel-intro">
        <h1 className="login-panel-title">{t("loginTitle")}</h1>
        <p className="login-panel-subtitle">{t("loginSubtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="login-panel-form">
        <div className="login-field">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="h-10"
          />
        </div>
        <div className="login-field">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="h-10"
          />
        </div>
        {error ? (
          <div
            className="rounded-[var(--radius-sm)] border border-[var(--danger)]/25 bg-[var(--danger-muted)] px-3 py-2.5 text-sm text-[var(--danger)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="login-submit w-full"
          disabled={loading}
        >
          <Lock size={15} strokeWidth={2.25} aria-hidden />
          {loading ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      <footer className="login-panel-footer">
        <span className="login-footer-label">{t("demoHint")}</span>
        <code className="login-footer-code">admin@demo-hotel.ch</code>
      </footer>
    </div>
  );
}
