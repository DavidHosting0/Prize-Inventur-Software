"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { GroupShell } from "@/components/group-shell";
import { DataTablePanel } from "@/components/data-table-panel";

type AuditLog = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  accountType: string | null;
  user: { id: string; name: string; email: string } | null;
  hotel: { id: string; name: string } | null;
};

export default function GroupAuditLogsPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const { data, isLoading } = useQuery({
    queryKey: ["group-audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/audit-logs?limit=100");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ logs: AuditLog[] }>;
    },
  });

  const logs = data?.logs ?? [];

  return (
    <GroupShell
      title={t("auditTitle")}
      subtitle={t("auditSubtitle")}
      breadcrumbs={[{ label: tn("items.groupAuditLogs") }]}
    >
      <DataTablePanel
        title={t("auditTitle")}
        empty={
          isLoading ? tc("loading") : logs.length === 0 ? tc("noRows") : undefined
        }
      >
        {logs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--text-dim)]">
              <tr>
                <th className="px-4 py-2 font-medium">{t("when")}</th>
                <th className="px-4 py-2 font-medium">{t("action")}</th>
                <th className="px-4 py-2 font-medium">{t("entity")}</th>
                <th className="px-4 py-2 font-medium">{t("user")}</th>
                <th className="px-4 py-2 font-medium">{t("hotel")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">
                    {new Date(log.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {log.entity ?? "—"}
                    {log.entityId ? (
                      <div className="text-[var(--text-dim)]">{log.entityId}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-sm">{log.user?.name ?? "—"}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {log.user?.email}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    {log.hotel?.name ?? "—"}
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
