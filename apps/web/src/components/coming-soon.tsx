"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { Card, CardBody } from "@prize/ui";

export function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const tNav = useTranslations("nav.items");
  const t = useTranslations("common");
  return (
    <AppShell title={tNav(titleKey)}>
      <Card>
        <CardBody className="py-10 text-center text-sm text-[var(--text-muted)]">
          {t("comingSoon")}
        </CardBody>
      </Card>
    </AppShell>
  );
}
