"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { GroupShell } from "@/components/group-shell";
import { Badge, Card, CardBody, CardHeader, KpiCard } from "@prize/ui";
import { formatMoney } from "@/lib/money";
import { EnterHotelButton } from "@/components/enter-hotel-button";
import { DataTablePanel } from "@/components/data-table-panel";
import { Building2, PackageWarning } from "lucide-react";
import { Link } from "@/i18n/navigation";

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

type ByHotel = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  currency: string;
  imageUrl: string | null;
  revenueMonth: number;
  salesMonth: number;
  stockValue: number;
  criticalStock: number;
  wasteMonth: number;
};

export default function GroupDashboardPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const { data, isLoading } = useQuery({
    queryKey: ["group-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/dashboard");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        hotels: number;
        totals: {
          revenueToday: number;
          revenueWeek: number;
          revenueMonth: number;
          salesToday: number;
          stockValue: number;
          openOrders: number;
          wasteMonth: number;
          criticalStock: number;
        };
        byHotel: ByHotel[];
        revenueSeries: { date: string; amount: number }[];
        topHotels: { name: string; revenue: number }[];
        criticalProducts: {
          id: string;
          name: string;
          hotelName: string;
          qty: number;
          min: number;
        }[];
      }>;
    },
  });

  const totals = data?.totals;
  const currency = data?.byHotel?.[0]?.currency ?? "CHF";

  return (
    <GroupShell
      title={t("dashboardTitle")}
      subtitle={t("dashboardSubtitle")}
      breadcrumbs={[{ label: tn("items.groupDashboard") }]}
    >
      {isLoading || !totals ? (
        <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]">
                <Building2 className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text)]">
                  {t("portfolioTitle")}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t("portfolioHint", { count: data.hotels })}
                </div>
              </div>
            </div>
            <Link
              href="/group/hotels"
              className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--card-hover)]"
            >
              {t("manageHotels")}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 tablet:grid-cols-3">
            <KpiCard
              label={t("revenueToday")}
              value={formatMoney(totals.revenueToday, currency, locale)}
              tone="success"
            />
            <KpiCard
              label={t("revenueWeek")}
              value={formatMoney(totals.revenueWeek, currency, locale)}
            />
            <KpiCard
              label={t("revenueMonth")}
              value={formatMoney(totals.revenueMonth, currency, locale)}
            />
            <KpiCard label={t("salesToday")} value={totals.salesToday} />
            <KpiCard
              label={t("stockValue")}
              value={formatMoney(totals.stockValue, currency, locale)}
            />
            <KpiCard
              label={t("criticalStock")}
              value={totals.criticalStock}
              tone={totals.criticalStock > 0 ? "danger" : "success"}
            />
            <KpiCard label={t("openOrders")} value={totals.openOrders} />
            <KpiCard label={t("hotelsCount")} value={data.hotels} />
          </div>

          <DashboardCharts
            revenueSeries={data.revenueSeries ?? []}
            topProducts={(data.topHotels ?? []).map((h) => ({
              name: h.name,
              revenue: h.revenue,
            }))}
            revenueTitle={t("revenueChart")}
            topTitle={t("topHotels")}
          />

          <div>
            <div className="mb-2 text-sm font-semibold text-[var(--text)]">
              {t("hotelPortfolio")}
            </div>
            <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
              {(data.byHotel ?? []).map((h) => (
                <Card key={h.id} className="overflow-hidden">
                  <div className="relative h-36 bg-[var(--bg-elevated)]">
                    {h.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={h.imageUrl}
                        alt={h.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--text-dim)]">
                        <Building2 className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    {h.criticalStock > 0 ? (
                      <div className="absolute right-2 top-2">
                        <Badge tone="danger">
                          <span className="inline-flex items-center gap-1">
                            <PackageWarning className="h-3 w-3" />
                            {h.criticalStock}
                          </span>
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <CardBody className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold">{h.name}</div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {h.city ?? "—"} · /{h.slug}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-[var(--border-subtle)] px-2 py-1.5">
                        <div className="text-[var(--text-dim)]">{t("revenueMonth")}</div>
                        <div className="font-medium">
                          {formatMoney(h.revenueMonth, h.currency, locale)}
                        </div>
                      </div>
                      <div className="rounded-md border border-[var(--border-subtle)] px-2 py-1.5">
                        <div className="text-[var(--text-dim)]">{t("stockValue")}</div>
                        <div className="font-medium">
                          {formatMoney(h.stockValue, h.currency, locale)}
                        </div>
                      </div>
                    </div>
                    <EnterHotelButton
                      hotelId={h.id}
                      hotelSlug={h.slug}
                      label={t("enterHotel")}
                    />
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-3 desktop:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">{t("criticalAlerts")}</div>
              </CardHeader>
              <CardBody className="space-y-2">
                {(data.criticalProducts ?? []).length === 0 ? (
                  <div className="text-sm text-[var(--text-muted)]">
                    {t("noCriticalAlerts")}
                  </div>
                ) : (
                  (data.criticalProducts ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          {p.hotelName} · Min {p.min}
                        </div>
                      </div>
                      <Badge tone="danger">{p.qty}</Badge>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            <DataTablePanel title={t("byHotel")}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs text-[var(--text-dim)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("hotel")}</th>
                    <th className="px-4 py-2 font-medium">{t("revenueMonth")}</th>
                    <th className="px-4 py-2 font-medium">{t("salesMonth")}</th>
                    <th className="px-4 py-2 font-medium">{t("criticalStock")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byHotel ?? []).map((h) => (
                    <tr
                      key={h.id}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          {h.city ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {formatMoney(h.revenueMonth, h.currency, locale)}
                      </td>
                      <td className="px-4 py-2.5">{h.salesMonth}</td>
                      <td className="px-4 py-2.5">{h.criticalStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTablePanel>
          </div>
        </div>
      )}
    </GroupShell>
  );
}
