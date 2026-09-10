"use client";

import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, cn } from "@prize/ui";
import { PageToolbar } from "./page-toolbar";

export function DataTablePanel({
  title,
  actions,
  toolbar,
  toolbarRight,
  children,
  empty,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  toolbarRight?: ReactNode;
  children: ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {title || actions ? (
        <CardHeader>
          <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      {toolbar || toolbarRight ? (
        <PageToolbar right={toolbarRight}>{toolbar}</PageToolbar>
      ) : null}
      <CardBody className="p-0">
        {empty ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            {empty}
          </div>
        ) : (
          <div className="overflow-x-auto">{children}</div>
        )}
      </CardBody>
    </Card>
  );
}
