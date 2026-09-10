"use client";

import { useTranslations } from "next-intl";

const ROWS: { keys: string; actionKey: string }[] = [
  { keys: "Ctrl/⌘ K  or  /", actionKey: "search" },
  { keys: "Alt + N  or  [", actionKey: "focusNav" },
  { keys: "↑ ↓  then  Enter", actionKey: "navMove" },
  { keys: "g then d", actionKey: "dashboard" },
  { keys: "g then p", actionKey: "pos" },
  { keys: "g then w", actionKey: "warehouse" },
  { keys: "g then i", actionKey: "inventory" },
  { keys: "g then r", actionKey: "goodsReceipt" },
  { keys: "g then o", actionKey: "orders" },
  { keys: "g then a", actionKey: "products" },
  { keys: "Alt + 1…8", actionKey: "altDigits" },
  { keys: "?", actionKey: "thisHelp" },
  { keys: "Esc", actionKey: "close" },
];

export function ShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("shortcuts");
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">{t("title")}</div>
            <div className="text-xs text-[var(--text-dim)]">{t("subtitle")}</div>
          </div>
          <kbd className="kbd">Esc</kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {ROWS.map((row) => (
            <li
              key={row.actionKey}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
            >
              <span className="text-[var(--text-muted)]">{t(`actions.${row.actionKey}`)}</span>
              <kbd className="kbd shrink-0">{row.keys}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
