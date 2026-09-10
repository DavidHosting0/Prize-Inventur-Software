"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@prize/ui";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const t = useTranslations("notifications");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /** Badge only — light payload, rare poll, paused in background tabs. */
  const badge = useQuery({
    queryKey: ["notifications-badge"],
    queryFn: async () =>
      (await fetch("/api/v1/notifications?count=1")).json() as Promise<{
        unreadCount: number;
      }>,
    staleTime: 120_000,
    refetchInterval: open ? false : 180_000,
    refetchIntervalInBackground: false,
  });

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await fetch("/api/v1/notifications")).json() as Promise<{
        items: NotificationRow[];
        unreadCount: number;
      }>,
    enabled: open,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (payload: { all?: boolean; ids?: string[] }) => {
      const res = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-badge"] });
    },
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = open
    ? (list.data?.unreadCount ?? badge.data?.unreadCount ?? 0)
    : (badge.data?.unreadCount ?? 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative chrome-btn !min-h-[2.35rem] !px-2.5"
        title={t("title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <div className="text-sm font-semibold">{t("title")}</div>
            <Button
              size="sm"
              variant="ghost"
              disabled={unread === 0 || markRead.isPending}
              onClick={() => markRead.mutate({ all: true })}
            >
              {t("markAllRead")}
            </Button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {(list.data?.items ?? []).length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[var(--text-dim)]">
                {list.isLoading ? "…" : t("empty")}
              </li>
            ) : (
              (list.data?.items ?? []).map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-[var(--border)] px-3 py-2 ${
                    n.isRead ? "opacity-70" : "bg-[var(--primary-muted)]/30"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (!n.isRead) markRead.mutate({ ids: [n.id] });
                    }}
                  >
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">{n.body}</div>
                    <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
