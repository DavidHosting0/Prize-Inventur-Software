/**
 * Internal stock transfers are disabled — the hotel has a single central Lager.
 * Historical StockTransfer / TRANSFER movement rows remain for audit.
 */
import type { SessionUser } from "./rbac";
import type { CreateStockTransferInput } from "@prize/validators";

export async function createStockTransfer(
  _user: SessionUser,
  _input: CreateStockTransferInput
): Promise<never> {
  throw new Error("TRANSFERS_DISABLED");
}
