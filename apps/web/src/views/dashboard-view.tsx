"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader, KpiCard } from "@prize/ui";
import { formatMoney } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { ShoppingCart } from "lucide-react";

const DashboardCharts = dynamic(
  () =>
    import("@/components/dashboard-charts").then((m) => m.DashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-64 gap-3 desktop:grid-cols-3">
        <div className="desktop:col-span-2 animate-pulse rounded-[var(--radius-lg)] bg-[var(--card)]" />
        <div className="animate-pulse rounded-[var(--radius-lg)] bg-[var(--card)]" />
      </div>
    ),
  }
);

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const hotelLocale = session?.user?.hotelLocale ?? "de-CH";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/summary");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const k = data?.kpis;

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.dashboard") }]}
    >
      {isLoading || !k ? (
        <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)]">
            <div>
              <div className="text-sm font-bold text-[var(--text)]">{t("openPos")}</div>
              <div className="text-xs text-[var(--text-muted)]">{t("openPosHint")}</div>
            </div>
            <Link href="/pos">
              <Button className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                {t("openPos")}
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 tablet:grid-cols-3">
            <KpiCard
              label={t("revenueToday")}
              value={formatMoney(k.revenueToday, currency, hotelLocale)}
              tone="success"
            />
            <KpiCard
              label={t("revenueWeek")}
              value={formatMoney(k.revenueWeek, currency, hotelLocale)}
            />
            <KpiCard
              label={t("revenueMonth")}
              value={formatMoney(k.revenueMonth, currency, hotelLocale)}
            />
            <KpiCard label={t("salesCount")} value={k.salesCount} />
            <KpiCard
              label={t("stockValue")}
              value={formatMoney(k.stockValue, currency, hotelLocale)}
            />
            <KpiCard
              label={t("criticalItems")}
              value={k.criticalItems}
              tone={k.criticalItems > 0 ? "danger" : "success"}
              hint={k.belowMin ? `${k.belowMin} ${t("belowMin")}` : undefined}
            />
            <KpiCard label={t("openOrders")} value={k.openOrders} />
            <KpiCard
              label={t("inventoryDiffs")}
              value={k.openInventoryCounts}
              hint={t("alerts")}
            />
          </div>

          <DashboardCharts
            revenueSeries={data.revenueSeries}
            topProducts={data.topProducts}
            revenueTitle={t("revenueChart")}
            topTitle={t("topProducts")}
          />

          <div className="grid gap-3 desktop:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">{t("alerts")}</div>
              </CardHeader>
              <CardBody className="space-y-2">
                {(data.criticalProducts ?? []).map(
                  (p: { id: string; name: string; qty: number; min: number }, idx: number) => (
                    <div
                      key={`${p.id}-${idx}`}
                      className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          Min {p.min}
                        </div>
                      </div>
                      <Badge tone="danger">{p.qty}</Badge>
                    </div>
                  )
                )}
                {(data.alerts ?? []).map(
                  (a: { id: string; title: string; body: string }) => (
                    <div
                      key={a.id}
                      className="rounded-md border border-[var(--border-subtle)] px-3 py-2"
                    >
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">{a.body}</div>
                    </div>
                  )
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">{t("recentActivity")}</div>
              </CardHeader>
              <CardBody className="space-y-2">
                {(data.recentMovements ?? []).map(
                  (m: {
                    id: string;
                    type: string;
                    quantity: string;
                    reason: string | null;
                    createdAt: string;
                    product: { name: string };
                  }) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-2 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium">{m.product.name}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          {m.type} · {m.reason}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div
                          className={
                            Number(m.quantity) < 0
                              ? "text-[var(--danger)]"
                              : "text-[var(--success)]"
                          }
                        >
                          {Number(m.quantity) > 0 ? "+" : ""}
                          {Number(m.quantity)}
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {new Date(m.createdAt).toLocaleString(hotelLocale)}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
