"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { formatMoney } from "@/lib/money";
import { useSession } from "next-auth/react";

export default function PosConfigPreviewPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const [categoryId, setCategoryId] = useState("");

  const articles = useQuery({
    queryKey: ["pos-config-articles", "preview"],
    queryFn: async () =>
      (await fetch("/api/v1/pos-config/articles?active=1")).json(),
  });
  const cats = useQuery({
    queryKey: ["pos-config-categories"],
    queryFn: async () =>
      (await fetch("/api/v1/pos-config/categories?includeInactive=0")).json(),
  });

  const visible = useMemo(() => {
    let list = articles.data?.items ?? [];
    if (categoryId) {
      list = list.filter(
        (a: { posCategoryId?: string | null }) => a.posCategoryId === categoryId
      );
    }
    return list;
  }, [articles.data, categoryId]);

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.preview")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.preview") },
      ]}
    >
      <PosConfigNav />
      <p className="mb-3 text-sm text-[var(--text-muted)]">{t("previewHint")}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryId("")}
          className={
            !categoryId
              ? "min-h-11 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              : "min-h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium"
          }
        >
          {t("all")}
        </button>
        {(cats.data?.items ?? [])
          .filter((c: { isActive: boolean }) => c.isActive)
          .map((c: { id: string; name: string }) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={
                categoryId === c.id
                  ? "min-h-11 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                  : "min-h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium"
              }
            >
              {c.name}
            </button>
          ))}
      </div>
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
        {visible.map(
          (a: {
            id: string;
            name: string;
            salePrice: string;
            isFavorite: boolean;
            type: string;
          }) => (
            <div
              key={a.id}
              className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="text-[15px] font-semibold">
                {a.name}
                {a.isFavorite ? (
                  <span className="ml-1 text-[var(--warning)]">★</span>
                ) : null}
                <div className="mt-1 text-[10px] font-medium uppercase text-[var(--text-dim)]">
                  {a.type === "RECIPE" ? t("typeRecipe") : t("typeProduct")}
                </div>
              </div>
              <div className="mt-3 text-lg font-semibold text-[var(--primary)]">
                {formatMoney(a.salePrice, currency, locale)}
              </div>
            </div>
          )
        )}
      </div>
    </AppShell>
  );
}
