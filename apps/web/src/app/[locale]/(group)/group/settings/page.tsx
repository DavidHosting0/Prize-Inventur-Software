"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { GroupShell } from "@/components/group-shell";
import { Card, CardBody, CardHeader, Input, Label } from "@prize/ui";

export default function GroupSettingsPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const hotels = useQuery({
    queryKey: ["group-hotels"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/hotels");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ hotels: { id: string; name: string }[] }>;
    },
  });

  return (
    <GroupShell
      title={t("settingsTitle")}
      subtitle={t("settingsSubtitle")}
      breadcrumbs={[{ label: tn("items.groupSettings") }]}
    >
      <Card className="max-w-lg">
        <CardHeader>
          <div className="text-sm font-semibold">{t("organization")}</div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <Label>{t("organizationId")}</Label>
            <Input value={session?.user?.organizationId ?? ""} readOnly disabled />
          </div>
          <div>
            <Label>{t("role")}</Label>
            <Input value={session?.user?.roleCode ?? ""} readOnly disabled />
          </div>
          <div>
            <Label>{t("hotelsCount")}</Label>
            <Input
              value={
                hotels.isLoading
                  ? tc("loading")
                  : String(hotels.data?.hotels?.length ?? 0)
              }
              readOnly
              disabled
            />
          </div>
          <p className="text-xs text-[var(--text-dim)]">{t("settingsHint")}</p>
        </CardBody>
      </Card>
    </GroupShell>
  );
}
