import { prisma } from "./db";
import type { AccountType } from "@prize/types";

export async function writeAuditLog(input: {
  organizationId?: string | null;
  hotelId?: string | null;
  userId?: string | null;
  accountType?: AccountType | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      hotelId: input.hotelId ?? null,
      userId: input.userId ?? null,
      accountType: input.accountType ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue ? (input.oldValue as object) : undefined,
      newValue: input.newValue ? (input.newValue as object) : undefined,
      ip: input.ip ?? null,
    },
  });
}
