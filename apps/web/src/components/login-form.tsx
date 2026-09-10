"use client";

import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";

const REMEMBER_KEY = "prize-login-email";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@demo-hotel.ch");
  const [password, setPassword] = useState("Demo123!");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

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

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }

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

  async function onInstallClick() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }

  return (
    <div className="login-form-wrap">
      <div className="login-form-head">
        <p className="login-beta">{t("beta")}</p>
        <h1 className="login-form-title">{t("loginTitle")}</h1>
        <p className="login-form-welcome">{t("welcomeBack")}</p>
      </div>

      <form onSubmit={onSubmit} className="login-form">
        <div className="login-field">
          <label htmlFor="email" className="login-label">
            {t("username")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="login-input"
          />
        </div>

        <div className="login-field">
          <label htmlFor="password" className="login-label">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="login-input"
          />
        </div>

        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="login-form-meta">
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>{t("rememberUsername")}</span>
          </label>
          <a className="login-link" href="mailto:admin@demo-hotel.ch">
            {t("contactAdmin")}
          </a>
        </div>

        <button type="submit" className="login-submit" disabled={loading}>
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <div className="login-form-foot">
        {installEvent ? (
          <button type="button" className="login-install" onClick={onInstallClick}>
            {t("installApp")}
          </button>
        ) : (
          <span className="login-install login-install-static">{t("installApp")}</span>
        )}
      </div>
    </div>
  );
}
