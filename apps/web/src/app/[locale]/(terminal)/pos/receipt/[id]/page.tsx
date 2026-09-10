"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { PosTerminalShell } from "@/components/pos-terminal-shell";
import { Badge, Button, Card, CardBody, CardHeader } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { Link } from "@/i18n/navigation";

export default function ReceiptPage() {
  const t = useTranslations("receipt");
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const { data: sale } = useQuery({
    queryKey: ["sale", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/sales/${params.id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (!sale) {
    return (
      <PosTerminalShell>
        <div className="p-6 text-[var(--text-muted)]">…</div>
      </PosTerminalShell>
    );
  }

  const payments = (sale.payments ?? []) as {
    method: string;
    reference?: string | null;
    amount: string;
  }[];

  return (
    <PosTerminalShell>
      <div className="mx-auto max-w-lg space-y-3 p-4 md:p-6">
        <div className="flex gap-2 print:hidden">
          <Link href="/pos">
            <Button variant="secondary" size="sm">
              POS
            </Button>
          </Link>
          <Button size="sm" onClick={() => window.print()}>
            {t("print")}
          </Button>
        </div>

        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">{session?.user?.hotelName}</div>
              <div className="text-xs text-[var(--text-muted)]">{t("title")}</div>
              <div className="mt-1 font-mono text-xs text-[var(--text-dim)]">{sale.transactionNo}</div>
            </div>
            <Badge tone={sale.status === "PAID" ? "success" : "warning"}>{sale.status}</Badge>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
              <div>
                {t("date")}: {new Date(sale.paidAt ?? sale.createdAt).toLocaleDateString(locale)}
              </div>
              <div>
                {t("time")}: {new Date(sale.paidAt ?? sale.createdAt).toLocaleTimeString(locale)}
              </div>
              <div>
                {t("employee")}: {sale.cashier?.name}
              </div>
              <div>
                {t("transactionNo")}: {sale.transactionNo}
              </div>
            </div>

            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("items")}</th>
                  <th>Qty</th>
                  <th>{t("unitPrice")}</th>
                  <th>{t("grandTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map(
                  (item: {
                    id: string;
                    nameSnapshot: string;
                    quantity: string;
                    unitPrice: string;
                    lineTotal: string;
                    vatRate: string;
                    isComplimentary?: boolean;
                  }) => (
                    <tr key={item.id}>
                      <td>
                        {item.nameSnapshot}
                        {item.isComplimentary ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-[var(--success)]">
                            {t("freeItem")}
                          </span>
                        ) : null}
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {t("vat")} {item.vatRate}%
                        </div>
                      </td>
                      <td>{toNumber(item.quantity)}</td>
                      <td>{formatMoney(item.unitPrice, currency, locale)}</td>
                      <td>{formatMoney(item.lineTotal, currency, locale)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {toNumber(sale.discountAmount) > 0 ? (
              <div className="flex justify-between text-sm text-[var(--text-muted)]">
                <span>
                  {t("discount")}
                  {sale.voucherCode ? ` (${t("voucher")}: ${sale.voucherCode})` : ""}
                  {sale.discountType && sale.discountType !== "NONE"
                    ? ` · ${sale.discountType}`
                    : ""}
                </span>
                <span>−{formatMoney(sale.discountAmount, currency, locale)}</span>
              </div>
            ) : null}

            {sale.discountReason ? (
              <div className="text-xs text-[var(--text-muted)]">
                {t("notes")}: {sale.discountReason}
              </div>
            ) : null}

            <div className="flex justify-between border-t border-[var(--border)] pt-3 text-base font-semibold">
              <span>{t("grandTotal")}</span>
              <span>{formatMoney(sale.total, currency, locale)}</span>
            </div>

            <div className="space-y-1 text-xs text-[var(--text-muted)]">
              <div>
                {t("paymentMethod")}:{" "}
                {payments.map((p) => p.method).join(", ") || "—"}
              </div>
              {payments
                .filter((p) => p.reference)
                .map((p, idx) => (
                  <div key={idx}>
                    {t("reference")}: {p.reference}
                  </div>
                ))}
              {sale.notes ? (
                <div>
                  {t("notes")}: {sale.notes}
                </div>
              ) : null}
            </div>

            {(sale.roomReference || sale.guestName) && (
              <div className="rounded-md bg-[var(--border-subtle)] px-3 py-2 text-xs">
                {sale.roomReference ? (
                  <div>
                    {t("roomRef")}: {sale.roomReference} (reference only)
                  </div>
                ) : null}
                {sale.guestName ? (
                  <div>
                    {t("guestName")}: {sale.guestName}
                  </div>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PosTerminalShell>
  );
}
