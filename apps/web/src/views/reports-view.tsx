"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, CardBody } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { DataTablePanel } from "@/components/data-table-panel";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const [days, setDays] = useState(30);

  const data = useQuery({
    queryKey: ["reports", days],
    queryFn: async () =>
      (await fetch(`/api/v1/reports/summary?days=${days}`)).json(),
  });

  const summary = data.data?.summary;

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.reports") }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/v1/reports/summary?days=${days}&format=csv`}>
            <Button size="sm" variant="secondary">
              {t("exportCsv")}
            </Button>
          </a>
          <a href={`/api/v1/reports/export?days=${days}&format=xlsx`}>
            <Button size="sm" variant="secondary">
              {t("exportExcel")}
            </Button>
          </a>
          <a href={`/api/v1/reports/export?days=${days}&format=pdf`}>
            <Button size="sm" variant="secondary">
              {t("exportPdf")}
            </Button>
          </a>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[7, 14, 30, 90].map((d) => (
          <Button
            key={d}
            size="sm"
            variant={days === d ? "primary" : "secondary"}
            onClick={() => setDays(d)}
          >
            {d}d
          </Button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 tablet:grid-cols-4">
        {[
          { label: t("revenue"), value: summary ? formatMoney(summary.revenue, currency, locale) : "—" },
          { label: t("salesCount"), value: summary?.salesCount ?? "—" },
          { label: t("wasteCost"), value: summary ? formatMoney(summary.wasteCost, currency, locale) : "—" },
          { label: t("critical"), value: summary?.criticalCount ?? "—" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardBody>
              <div className="text-xs text-[var(--text-dim)]">{kpi.label}</div>
              <div className="text-xl font-semibold">{kpi.value}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 desktop:grid-cols-2">
        <DataTablePanel title={t("movements")}>
          <table className="app-table">
            <thead>
              <tr>
                <th>{t("type")}</th>
                <th>{t("count")}</th>
                <th>{t("qty")}</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.movementsByType ?? []).map(
                (m: { type: string; count: number; quantity: number }) => (
                  <tr key={m.type}>
                    <td>{m.type}</td>
                    <td>{m.count}</td>
                    <td>{m.quantity}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </DataTablePanel>

        <DataTablePanel title={t("lowStock")}>
          <table className="app-table">
            <thead>
              <tr>
                <th>{t("product")}</th>
                <th>{t("qty")}</th>
                <th>{t("min")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.data?.critical ?? []).map(
                (row: {
                  sku: string;
                  product: string;
                  quantity: number;
                  minStock: number;
                }) => (
                  <tr key={row.sku}>
                    <td>{row.product}</td>
                    <td>{row.quantity}</td>
                    <td>{row.minStock}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </DataTablePanel>
      </div>

      <div className="mt-4">
        <DataTablePanel title={t("recentSales")}>
          <table className="app-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("when")}</th>
                <th>{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.data?.sales ?? []).map(
                (s: {
                  id: string;
                  transactionNo: string;
                  paidAt: string | null;
                  total: string | number;
                }) => (
                  <tr key={s.id}>
                    <td>{s.transactionNo}</td>
                    <td className="text-xs text-[var(--text-dim)]">
                      {s.paidAt ? new Date(s.paidAt).toLocaleString() : "—"}
                    </td>
                    <td>
                      {formatMoney(toNumber(s.total), currency, locale)}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </DataTablePanel>
      </div>
    </AppShell>
  );
}
