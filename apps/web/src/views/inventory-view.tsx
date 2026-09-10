"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useMemo, useState, type MouseEvent } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Plus,
  User,
  Warehouse,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InlineAlert } from "@/components/inline-alert";
import { useHotelSection } from "@/components/hotel-section-provider";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";

type InventoryCountRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  closedAt: string | null;
  warehouse: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  _count: { items: number };
};

const ACTIVE_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "REVIEW"]);

function statusTone(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "CLOSED") return "success";
  if (status === "IN_PROGRESS" || status === "REVIEW") return "warning";
  if (status === "CANCELLED") return "danger";
  return "default";
}

function formatDate(
  value: string | null | undefined,
  locale: string,
  withTime = false
) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
  });
}

function periodLabel(c: InventoryCountRow, locale: string) {
  const anchor = c.closedAt ?? c.startedAt ?? c.createdAt;
  const d = new Date(anchor);
  if (Number.isNaN(d.getTime())) return c.name;
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} ${d.getFullYear()} · ${d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
}

function groupByYear(items: InventoryCountRow[]) {
  const map = new Map<string, InventoryCountRow[]>();
  for (const c of items) {
    const year = new Date(c.closedAt ?? c.startedAt ?? c.createdAt)
      .getFullYear()
      .toString();
    const list = map.get(year) ?? [];
    list.push(c);
    map.set(year, list);
  }
  return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
}

export default function InventoryPage() {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const { navigateAppPath } = useHotelSection();
  const qc = useQueryClient();
  const dateLocale = session?.user?.hotelLocale ?? "de-CH";

  const [name, setName] = useState(() => {
    const today = new Date().toLocaleDateString(dateLocale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return `${t("defaultNamePrefix")} ${today}`;
  });
  const [error, setError] = useState<string | null>(null);

  const lists = useQuery({
    queryKey: ["inventory-counts"],
    queryFn: async () => (await fetch("/api/v1/inventory-counts")).json(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/inventory-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? t("createFailed"));
      return res.json();
    },
    onSuccess: (count: { id: string }) => {
      qc.invalidateQueries({ queryKey: ["inventory-counts"] });
      navigateAppPath(`/inventory/${count.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const items: InventoryCountRow[] = lists.data?.items ?? [];
  const active = useMemo(
    () => items.filter((c) => ACTIVE_STATUSES.has(c.status)),
    [items]
  );
  const history = useMemo(
    () => items.filter((c) => !ACTIVE_STATUSES.has(c.status)),
    [items]
  );
  const historyByYear = useMemo(() => groupByYear(history), [history]);

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.inventory") }]}
    >
      {error ? <InlineAlert className="mb-4">{error}</InlineAlert> : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {t("stats.active")}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {active.length}
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {t("stats.closed")}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {history.filter((c) => c.status === "CLOSED").length}
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {t("stats.cadence")}
          </div>
          <div className="mt-1 text-sm font-medium leading-snug text-[var(--text)]">
            {t("stats.cadenceHint")}
          </div>
        </div>
      </div>

      {active.length > 0 ? (
        <section className="mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {t("activeTitle")}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">{t("activeHint")}</p>
          </div>
          <div className="space-y-3">
            {active.map((c) => (
              <ActiveCountCard
                key={c.id}
                count={c}
                dateLocale={dateLocale}
                openLabel={t("open")}
                statusLabel={t(`status.${c.status}` as "status.IN_PROGRESS")}
                itemCountLabel={t("itemCount", {
                  count: c._count?.items ?? 0,
                })}
                startedLabel={t("startedAt")}
                onOpen={() => navigateAppPath(`/inventory/${c.id}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">
              {t("startPanelTitle")}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {t("startPanelHint")}
            </p>
          </div>
        </CardHeader>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="inventory-name">{t("nameLabel")}</Label>
            <Input
              id="inventory-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <Button
            variant="success"
            size="lg"
            onClick={() => {
              setError(null);
              createMutation.mutate();
            }}
            disabled={createMutation.isPending || !name.trim()}
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? tc("loading") : t("start")}
          </Button>
        </CardBody>
      </Card>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-[var(--border)] pb-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {t("historyTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {t("historyHint")}
            </p>
          </div>
          <span className="text-xs tabular-nums text-[var(--text-dim)]">
            {t("historyCount", { count: history.length })}
          </span>
        </div>

        {lists.isLoading ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
            {tc("loading")}
          </div>
        ) : history.length === 0 && active.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-[var(--text-dim)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text)]">
              {t("emptyTitle")}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-muted)]">
              {t("emptyHint")}
            </p>
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            {t("noHistory")}
          </div>
        ) : (
          <div className="space-y-6">
            {historyByYear.map(([year, rows]) => (
              <div key={year}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                    {year}
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-[10px] tabular-nums text-[var(--text-dim)]">
                    {rows.length}
                  </span>
                </div>
                <ul className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]">
                  {rows.map((c, idx) => (
                    <li
                      key={c.id}
                      className={
                        idx > 0
                          ? "border-t border-[var(--border-subtle)]"
                          : undefined
                      }
                    >
                      <HistoryCountRow
                        count={c}
                        dateLocale={dateLocale}
                        openLabel={t("open")}
                        statusLabel={t(`status.${c.status}` as "status.CLOSED")}
                        period={periodLabel(c, dateLocale)}
                        labels={{
                          warehouse: tc("warehouse"),
                          createdBy: t("createdBy"),
                          started: t("startedAt"),
                          closed: t("closedAt"),
                          items: t("itemCount", {
                            count: c._count?.items ?? 0,
                          }),
                        }}
                        onOpen={() => navigateAppPath(`/inventory/${c.id}`)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function OpenInventoryButton({
  label,
  className,
  onOpen,
}: {
  label: string;
  className: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function ActiveCountCard({
  count,
  dateLocale,
  openLabel,
  statusLabel,
  itemCountLabel,
  startedLabel,
  onOpen,
}: {
  count: InventoryCountRow;
  dateLocale: string;
  openLabel: string;
  statusLabel: string;
  itemCountLabel: string;
  startedLabel: string;
  onOpen: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--warning)]/35 bg-[var(--card)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-stretch gap-0">
        <div className="w-1.5 shrink-0 bg-[var(--warning)]" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(count.status)}>{statusLabel}</Badge>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                {periodLabel(count, dateLocale)}
              </span>
            </div>
            <h3 className="truncate text-base font-semibold text-[var(--text)]">
              {count.name}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                {count.warehouse?.name ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                {itemCountLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                {startedLabel}:{" "}
                {formatDate(count.startedAt ?? count.createdAt, dateLocale, true)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                {count.createdBy?.name || count.createdBy?.email || "—"}
              </span>
            </div>
          </div>
          <OpenInventoryButton
            label={openLabel}
            onOpen={onOpen}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </div>
      </div>
    </div>
  );
}

function HistoryCountRow({
  count,
  dateLocale,
  openLabel,
  statusLabel,
  period,
  labels,
  onOpen,
}: {
  count: InventoryCountRow;
  dateLocale: string;
  openLabel: string;
  statusLabel: string;
  period: string;
  labels: {
    warehouse: string;
    createdBy: string;
    started: string;
    closed: string;
    items: string;
  };
  onOpen: () => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--card-hover)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(count.status)}>{statusLabel}</Badge>
          <span className="text-[11px] font-medium text-[var(--text-dim)]">
            {period}
          </span>
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">
          {count.name}
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          {labels.warehouse}: {count.warehouse?.name ?? "—"}
          <span className="mx-1.5 text-[var(--border)]">·</span>
          {labels.items}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {labels.started}
          </dt>
          <dd className="mt-0.5 text-[var(--text-muted)]">
            {formatDate(count.startedAt ?? count.createdAt, dateLocale)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {labels.closed}
          </dt>
          <dd className="mt-0.5 text-[var(--text-muted)]">
            {formatDate(count.closedAt, dateLocale)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {labels.createdBy}
          </dt>
          <dd className="mt-0.5 truncate text-[var(--text-muted)]">
            {count.createdBy?.name || count.createdBy?.email || "—"}
          </dd>
        </div>
      </dl>

      <div className="sm:justify-self-end">
        <OpenInventoryButton
          label={openLabel}
          onOpen={onOpen}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-elevated)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
      </div>
    </div>
  );
}
