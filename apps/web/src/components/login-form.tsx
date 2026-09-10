"use client";

import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@prize/ui";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";

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

  const modules = [
    t("capabilityInventory"),
    t("capabilityPos"),
    t("capabilityOps"),
  ];

  return (
    <section className="login-station" aria-labelledby="login-station-title">
      <div className="login-station-titlebar">
        <h1 id="login-station-title">{t("loginTitle")}</h1>
        <span className="login-station-titlebar-meta">{t("accessLabel")}</span>
      </div>

      <div className="login-station-body">
        <aside className="login-station-info">
          <h2 className="login-station-section">{t("systemSection")}</h2>
          <dl className="login-spec">
            <div>
              <dt>{t("specGroup")}</dt>
              <dd>{t("panelEyebrow")}</dd>
            </div>
            <div>
              <dt>{t("specProduct")}</dt>
              <dd>
                {t("brandName")} · {t("brandTag")}
              </dd>
            </div>
            <div>
              <dt>{t("specModules")}</dt>
              <dd>
                <ul className="login-module-list">
                  {modules.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>{t("specScope")}</dt>
              <dd>{t("loginSubtitle")}</dd>
            </div>
          </dl>
        </aside>

        <div className="login-station-credentials">
          <h2 className="login-station-section">{t("credentialsSection")}</h2>
          <form onSubmit={onSubmit} className="login-cred-form">
            <div className="login-cred-row">
              <Label htmlFor="email" className="login-cred-label">
                {t("email")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                className="login-cred-input"
              />
            </div>
            <div className="login-cred-row">
              <Label htmlFor="password" className="login-cred-label">
                {t("password")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="login-cred-input"
              />
            </div>

            {error ? (
              <div className="login-cred-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="login-cred-actions">
              <Button
                type="submit"
                className="login-cred-submit"
                disabled={loading}
              >
                {loading ? t("signingIn") : t("signIn")}
              </Button>
            </div>
          </form>

          <div className="login-cred-note">
            <span>{t("demoHint")}</span>
            <code>admin@demo-hotel.ch</code>
          </div>
        </div>
      </div>
    </section>
  );
}
