"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { GroupShell } from "@/components/group-shell";
import { Badge, Card, CardBody, CardHeader } from "@prize/ui";

type RoleRow = {
  id: string;
  code: string;
  name: string;
  scope: string;
  description: string | null;
  userCount: number;
  permissions: string[];
};

export default function GroupPermissionsPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");

  const { data, isLoading } = useQuery({
    queryKey: ["group-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/permissions");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        roles: RoleRow[];
        permissions: { id: string; code: string; description: string | null }[];
      }>;
    },
  });

  if (isLoading || !data) {
    return (
      <GroupShell
        title={t("permissionsTitle")}
        subtitle={t("permissionsSubtitle")}
        breadcrumbs={[{ label: tn("items.groupPermissions") }]}
      >
        <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
      </GroupShell>
    );
  }

  return (
    <GroupShell
      title={t("permissionsTitle")}
      subtitle={t("permissionsSubtitle")}
      breadcrumbs={[{ label: tn("items.groupPermissions") }]}
    >
      <div className="space-y-4">
        <div className="grid gap-3 desktop:grid-cols-2">
          {data.roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{role.name}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {role.code} · {role.scope} · {role.userCount} {t("users")}
                    </div>
                  </div>
                  <Badge>{role.scope}</Badge>
                </div>
              </CardHeader>
              <CardBody>
                {role.description ? (
                  <p className="mb-2 text-xs text-[var(--text-muted)]">
                    {role.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((code) => (
                    <span
                      key={code}
                      className="rounded border border-[var(--border)] bg-[var(--input-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
                    >
                      {code}
                    </span>
                  ))}
                  {role.permissions.length === 0 ? (
                    <span className="text-xs text-[var(--text-dim)]">—</span>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">{t("allPermissions")}</div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {data.permissions.map((p) => (
                <span
                  key={p.id}
                  className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
                  title={p.description ?? undefined}
                >
                  {p.code}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </GroupShell>
  );
}
