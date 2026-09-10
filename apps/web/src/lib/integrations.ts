import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "./integration-secrets";

export const OCR_DELIVERY_NOTE_PURPOSE = "OCR_DELIVERY_NOTE";

export type IntegrationPublicDto = {
  id: string;
  provider: string;
  purpose: string;
  model: string | null;
  enabled: boolean;
  settings: Prisma.JsonValue | null;
  hasSecret: boolean;
  secretMasked: string | null;
};

export type UpsertIntegrationInput = {
  provider: string;
  purpose: string;
  model?: string | null;
  enabled?: boolean;
  settings?: Prisma.InputJsonValue | null;
  apiKey?: string | null;
};

export type OcrConfig = {
  apiKey: string;
  model: string;
  provider: string;
};

function toPublicDto(row: {
  id: string;
  provider: string;
  purpose: string;
  model: string | null;
  enabled: boolean;
  settings: Prisma.JsonValue | null;
  secretCiphertext: string | null;
  secretIv: string | null;
  secretAuthTag: string | null;
}): IntegrationPublicDto {
  const hasSecret = Boolean(
    row.secretCiphertext && row.secretIv && row.secretAuthTag
  );
  let secretMasked: string | null = null;
  if (hasSecret && row.secretCiphertext && row.secretIv && row.secretAuthTag) {
    try {
      const plain = decryptSecret(
        row.secretCiphertext,
        row.secretIv,
        row.secretAuthTag
      );
      secretMasked = maskSecret(plain);
    } catch {
      secretMasked = "••••";
    }
  }
  return {
    id: row.id,
    provider: row.provider,
    purpose: row.purpose,
    model: row.model,
    enabled: row.enabled,
    settings: row.settings,
    hasSecret,
    secretMasked,
  };
}

export async function listIntegrations(
  organizationId: string
): Promise<IntegrationPublicDto[]> {
  const rows = await prisma.systemIntegration.findMany({
    where: { organizationId },
    orderBy: [{ purpose: "asc" }, { provider: "asc" }],
  });
  return rows.map(toPublicDto);
}

export async function upsertIntegration(
  organizationId: string,
  input: UpsertIntegrationInput
): Promise<IntegrationPublicDto> {
  const apiKey = input.apiKey?.trim();
  const secretFields =
    apiKey
      ? (() => {
          const enc = encryptSecret(apiKey);
          return {
            secretCiphertext: enc.ciphertext,
            secretIv: enc.iv,
            secretAuthTag: enc.authTag,
          };
        })()
      : {};

  const data = {
    model: input.model === undefined ? undefined : input.model,
    enabled: input.enabled,
    settings:
      input.settings === undefined
        ? undefined
        : input.settings === null
          ? Prisma.JsonNull
          : input.settings,
    ...secretFields,
  };

  const row = await prisma.systemIntegration.upsert({
    where: {
      organizationId_purpose_provider: {
        organizationId,
        purpose: input.purpose,
        provider: input.provider,
      },
    },
    create: {
      organizationId,
      provider: input.provider,
      purpose: input.purpose,
      model: input.model ?? null,
      enabled: input.enabled ?? false,
      settings: input.settings === null ? Prisma.JsonNull : input.settings ?? undefined,
      ...secretFields,
    },
    update: data,
  });

  return toPublicDto(row);
}

export async function getIntegrationSecret(
  organizationId: string,
  purpose: string
): Promise<string | null> {
  const row = await prisma.systemIntegration.findFirst({
    where: {
      organizationId,
      purpose,
      enabled: true,
      secretCiphertext: { not: null },
      secretIv: { not: null },
      secretAuthTag: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row?.secretCiphertext || !row.secretIv || !row.secretAuthTag) {
    return null;
  }
  try {
    return decryptSecret(
      row.secretCiphertext,
      row.secretIv,
      row.secretAuthTag
    );
  } catch {
    return null;
  }
}

export async function getOcrConfig(
  organizationId: string
): Promise<OcrConfig | null> {
  const row = await prisma.systemIntegration.findFirst({
    where: {
      organizationId,
      purpose: OCR_DELIVERY_NOTE_PURPOSE,
      enabled: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (row?.secretCiphertext && row.secretIv && row.secretAuthTag) {
    try {
      const apiKey = decryptSecret(
        row.secretCiphertext,
        row.secretIv,
        row.secretAuthTag
      );
      if (apiKey.trim()) {
        return {
          apiKey: apiKey.trim(),
          model: row.model?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o",
          provider: row.provider,
        };
      }
    } catch {
      // fall through to env
    }
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (!envKey) return null;

  return {
    apiKey: envKey,
    model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o",
    provider: "openai",
  };
}
