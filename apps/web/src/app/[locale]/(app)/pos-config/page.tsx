"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Card, CardBody, KpiCard } from "@prize/ui";
import { Link } from "@/i18n/navigation";

export default function PosConfigOverviewPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const { data } = useQuery({
    queryKey: ["pos-config-overview"],
    queryFn: async () => (await fetch("/api/v1/pos-config/overview")).json(),
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
      ]}
    >
      <PosConfigNav />
      <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
        <KpiCard label={t("articlesCount")} value={String(data?.articles ?? "—")} />
        <KpiCard label={t("activeArticles")} value={String(data?.activeArticles ?? "—")} tone="success" />
        <KpiCard label={t("categoriesCount")} value={String(data?.categories ?? "—")} />
        <KpiCard label={t("recipesCount")} value={String(data?.recipes ?? "—")} />
        <KpiCard label={t("productArticles")} value={String(data?.productArticles ?? "—")} />
        <KpiCard label={t("recipeArticles")} value={String(data?.recipeArticles ?? "—")} />
      </div>
      <div className="mt-4 grid gap-3 tablet:grid-cols-2">
        <Card>
          <CardBody className="space-y-2 text-sm">
            <Link href="/pos-config/articles" className="font-semibold text-[var(--primary)] hover:underline">
              {t("tabs.articles")} →
            </Link>
            <p className="text-[var(--text-muted)]">{t("backfillHint")}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2 text-sm">
            <Link href="/pos-config/preview" className="font-semibold text-[var(--primary)] hover:underline">
              {t("tabs.preview")} →
            </Link>
            <p className="text-[var(--text-muted)]">{t("previewHint")}</p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
