"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { Button, Card, CardBody } from "@prize/ui";
import { Link } from "@/i18n/navigation";

export default function TransfersPage() {
  const t = useTranslations("transfers");
  const tn = useTranslations("nav");

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.transfers") }]}
    >
      <Card className="max-w-lg">
        <CardBody className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">{t("disabledMessage")}</p>
          <Link href="/warehouse">
            <Button variant="secondary">{t("goToWarehouse")}</Button>
          </Link>
        </CardBody>
      </Card>
    </AppShell>
  );
}
