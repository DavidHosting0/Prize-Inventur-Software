"use client";

import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@prize/ui";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";
import { BrandMark } from "./brand-mark";

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
    <div className="w-full max-w-[420px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
      <div className="border-b border-[var(--border)] bg-gradient-to-b from-white to-[#f8fafc] px-5 py-4">
        <BrandMark
          name={t("brandName")}
          tag={t("brandTag")}
          className="sidebar-brand !h-auto !min-h-0 !border-0 !bg-transparent !p-0"
        />
      </div>
      <div className="border-b border-[var(--border-subtle)] px-6 pt-5 pb-1">
        <h1 className="text-lg font-bold tracking-tight text-[var(--text)]">
          {t("loginTitle")}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {t("loginSubtitle")}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <div className="rounded-md border border-[var(--danger)]/25 bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "…" : t("signIn")}
        </Button>
      </form>
      <div className="border-t border-[var(--border)] bg-[#f8fafc] px-6 py-3 text-[11px] text-[var(--text-dim)]">
        {locale.toUpperCase()} · admin@demo-hotel.ch
      </div>
    </div>
  );
}
