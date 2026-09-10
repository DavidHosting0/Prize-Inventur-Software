"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Button, Card, CardBody } from "@prize/ui";
import { Link } from "@/i18n/navigation";

export default function PosConfigSettingsPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.settings")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.settings") },
      ]}
    >
      <PosConfigNav />
      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--text-muted)]">{t("settingsHint")}</p>
          <Link href="/settings">
            <Button>{t("openSettings")}</Button>
          </Link>
        </CardBody>
      </Card>
    </AppShell>
  );
}
