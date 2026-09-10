import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireGroupAccount } from "@/lib/tenant";
import { listIntegrations, upsertIntegration } from "@/lib/integrations";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import {
  INTEGRATION_PROVIDERS,
  INTEGRATION_PURPOSES,
} from "@prize/types";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "ai_config.view");

    const integrations = await listIntegrations(user.organizationId);
    return NextResponse.json({ integrations });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}

const upsertSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
  purpose: z.enum(INTEGRATION_PURPOSES),
  model: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional().nullable(),
  apiKey: z.string().min(1).optional(),
});

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    requireGroupAccount(user);
    assertPermission(user, "ai_config.manage");

    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Validation failed", 400);

    const row = await upsertIntegration(user.organizationId, {
      ...parsed.data,
      settings: parsed.data.settings as
        | import("@prisma/client").Prisma.InputJsonValue
        | null
        | undefined,
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      accountType: user.accountType,
      action: "integration.upsert",
      entity: "SystemIntegration",
      entityId: row.id,
      newValue: {
        provider: row.provider,
        purpose: row.purpose,
        model: row.model,
        enabled: row.enabled,
        hasSecret: row.hasSecret,
      },
    });

    return NextResponse.json(row);
  } catch (e) {
    if (isNextResponse(e)) return e;
    return jsonError("Server error", 500);
  }
}
