"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { GroupShell } from "@/components/group-shell";
import { DataTablePanel } from "@/components/data-table-panel";
import { formatMoney } from "@/lib/money";
import { EnterHotelButton } from "@/components/enter-hotel-button";

type HotelMetrics = {
  id: string;
  name: string;
  currency: string;
  revenue: number;
  sales: number;
  inventoryValue: number;
  wasteQty: number;
  wasteCount: number;
  purchaseOrders: number;
};

export default function GroupAnalyticsPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const { data, isLoading } = useQuery({
    queryKey: ["group-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/analytics?days=30");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        days: number;
        byHotel: HotelMetrics[];
      }>;
    },
  });

  const rows = data?.byHotel ?? [];

  return (
    <GroupShell
      title={t("analyticsTitle")}
      subtitle={t("analyticsSubtitle")}
      breadcrumbs={[{ label: tn("items.groupAnalytics") }]}
    >
      <DataTablePanel
        title={t("byHotel")}
        empty={
          isLoading ? tc("loading") : rows.length === 0 ? tc("noRows") : undefined
        }
      >
        {rows.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--text-dim)]">
              <tr>
                <th className="px-4 py-2 font-medium">{t("hotel")}</th>
                <th className="px-4 py-2 font-medium">{t("revenue")}</th>
                <th className="px-4 py-2 font-medium">{t("sales")}</th>
                <th className="px-4 py-2 font-medium">{t("inventoryValue")}</th>
                <th className="px-4 py-2 font-medium">{t("waste")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseOrders")}</th>
                <th className="px-4 py-2 font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{h.name}</td>
                  <td className="px-4 py-2.5">
                    {formatMoney(h.revenue, h.currency, locale)}
                  </td>
                  <td className="px-4 py-2.5">{h.sales}</td>
                  <td className="px-4 py-2.5">
                    {formatMoney(h.inventoryValue, h.currency, locale)}
                  </td>
                  <td className="px-4 py-2.5">
                    {h.wasteQty} / {h.wasteCount}
                  </td>
                  <td className="px-4 py-2.5">{h.purchaseOrders}</td>
                  <td className="px-4 py-2.5">
                    <EnterHotelButton hotelId={h.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTablePanel>
    </GroupShell>
  );
}
