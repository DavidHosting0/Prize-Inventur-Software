import { formatMoney as formatMoneyBase } from "@prize/types";

export function formatMoney(
  amount: number | string,
  currency: string,
  locale = "de-CH"
) {
  return formatMoneyBase({ amount, currency, locale });
}

export function toNumber(value: { toString(): string } | number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}
