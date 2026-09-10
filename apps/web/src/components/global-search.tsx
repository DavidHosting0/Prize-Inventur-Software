"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@prize/ui";

type Result = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setActive(0);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(0);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [q]);

  function go(index: number) {
    const r = results[index];
    if (!r) return;
    onClose();
    router.push(r.href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[11vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-[var(--border-subtle)] p-3">
          <Input
            autoFocus
            placeholder={t("placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(active);
              }
            }}
          />
          <div className="mt-2 flex gap-2 text-[10px] text-[var(--text-dim)]">
            <span>
              <kbd className="kbd">↑↓</kbd> {t("navigateHint")}
            </span>
            <span>
              <kbd className="kbd">Enter</kbd> {t("openHint")}
            </span>
            <span>
              <kbd className="kbd">Esc</kbd> {t("closeHint")}
            </span>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5" ref={listRef}>
          {loading ? (
            <div className="px-3 py-4 text-sm text-[var(--text-muted)]">…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[var(--text-muted)]">
              {t("noResults")}
            </div>
          ) : (
            results.map((r, idx) => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                data-kbd-index={idx}
                data-kbd-active={idx === active ? "true" : "false"}
                className={
                  idx === active
                    ? "flex w-full items-center justify-between rounded-md bg-[var(--primary-muted)] px-3 py-2 text-left"
                    : "flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-[var(--card-hover)]"
                }
                onMouseEnter={() => setActive(idx)}
                onClick={() => go(idx)}
              >
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-[var(--text-dim)]">{r.subtitle}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                  {r.type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
