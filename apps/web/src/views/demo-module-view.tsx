"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, KpiCard } from "@prize/ui";
import { DataTablePanel } from "@/components/data-table-panel";
import { formatMoney } from "@/lib/money";
import {
  DEMO_MODULES,
  type DemoCell,
  type DemoModuleId,
} from "@/lib/demo-modules";

function formatCell(
  cell: DemoCell,
  t: ReturnType<typeof useTranslations>,
  currency: string,
  locale: string
) {
  switch (cell.t) {
    case "text":
      return cell.v;
    case "num":
      return cell.v.toLocaleString(locale);
    case "money":
      return formatMoney(cell.v, currency, locale);
    case "pct":
      return `${cell.v.toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} %`;
    case "badge":
      return (
        <Badge tone={cell.tone} className="normal-case tracking-normal">
          {t(`status.${cell.v}`)}
        </Badge>
      );
    case "label":
      return t(`labels.${cell.v}`);
  }
}

export function DemoModuleView({ id }: { id: DemoModuleId }) {
  const t = useTranslations("demoModules");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const mod = DEMO_MODULES[id];

  return (
    <AppShell
      title={t(`${id}.title`)}
      subtitle={t(`${id}.subtitle`)}
      breadcrumbs={[{ label: tn(`items.${mod.navItemKey}`) }]}
      actions={
        <Button size="sm" variant="secondary" type="button">
          {t(`actions.${mod.actionKey}`)}
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 desktop:grid-cols-4">
        {mod.kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={t(`${id}.kpis.${kpi.key}`)}
            value={formatCell(kpi.value, t, currency, locale)}
            hint={kpi.hintKey ? t(kpi.hintKey) : undefined}
            tone={kpi.tone}
          />
        ))}
      </div>

      <div
        className={
          mod.tables.length > 1 ? "grid gap-4" : undefined
        }
      >
        {mod.tables.map((table) => (
          <DataTablePanel key={table.titleKey} title={t(`${id}.tables.${table.titleKey}`)}>
            <table className="app-table">
              <thead>
                <tr>
                  {table.columns.map((col) => (
                    <th key={col}>{t(`${id}.columns.${col}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={
                          cell.t === "money" ||
                          cell.t === "num" ||
                          cell.t === "pct" ||
                          cell.t === "badge"
                            ? "whitespace-nowrap tabular-nums"
                            : undefined
                        }
                      >
                        {formatCell(cell, t, currency, locale)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTablePanel>
        ))}
      </div>
    </AppShell>
  );
}
