"use client";

import { useTranslations } from "next-intl";
import { Button } from "@prize/ui";
import { Link } from "@/i18n/navigation";
import { productCreateUrl } from "@/lib/barcode-client";

type UnknownBarcodeActionsProps = {
  code: string;
  returnTo?: string | null;
  canCreate?: boolean;
  onCancel?: () => void;
  onSearch?: () => void;
  /** Extra query fragment after return, e.g. createdProductId placeholder handled by caller */
  createHref?: string;
  className?: string;
};

export function UnknownBarcodeActions({
  code,
  returnTo,
  canCreate = false,
  onCancel,
  onSearch,
  createHref,
  className,
}: UnknownBarcodeActionsProps) {
  const t = useTranslations("barcode");

  const href =
    createHref ??
    productCreateUrl({
      barcode: code,
      returnTo,
    });

  return (
    <div
      className={
        className ??
        "rounded-md bg-[var(--danger-muted)] px-3 py-3 text-center text-[var(--danger)]"
      }
    >
      <div className="font-semibold">{t("productNotFound")}</div>
      <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">{code}</div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {canCreate ? (
          <Link href={href}>
            <Button size="sm" variant="secondary">
              {t("createProduct")}
            </Button>
          </Link>
        ) : null}
        {onSearch ? (
          <Button size="sm" variant="secondary" onClick={onSearch}>
            {t("searchManually")}
          </Button>
        ) : null}
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
