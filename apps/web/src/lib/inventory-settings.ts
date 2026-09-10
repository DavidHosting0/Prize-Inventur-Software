import {
  DEFAULT_INVENTORY_SETTINGS,
  type InventorySettingsJson,
} from "@prize/types";
import { prisma } from "@/lib/db";

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseLiquidPresets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_INVENTORY_SETTINGS.liquidPresets];
  const presets = raw
    .map((v) => asFiniteNumber(v, NaN))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 20)
    .map((n) => Number(n.toFixed(3)));
  const unique = [...new Set(presets)].sort((a, b) => a - b);
  return unique.length > 0
    ? unique
    : [...DEFAULT_INVENTORY_SETTINGS.liquidPresets];
}

export function parseInventorySettings(
  raw: unknown
): InventorySettingsJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_INVENTORY_SETTINGS };
  }
  const row = raw as Record<string, unknown>;
  const liquidStep = Math.min(
    1,
    Math.max(
      0.01,
      asFiniteNumber(row.liquidStep, DEFAULT_INVENTORY_SETTINGS.liquidStep)
    )
  );
  const staleOpenDays = Math.min(
    365,
    Math.max(
      1,
      Math.round(
        asFiniteNumber(
          row.staleOpenDays,
          DEFAULT_INVENTORY_SETTINGS.staleOpenDays
        )
      )
    )
  );

  return {
    requireReviewBeforeClose:
      typeof row.requireReviewBeforeClose === "boolean"
        ? row.requireReviewBeforeClose
        : DEFAULT_INVENTORY_SETTINGS.requireReviewBeforeClose,
    allowCloseWithUncounted:
      typeof row.allowCloseWithUncounted === "boolean"
        ? row.allowCloseWithUncounted
        : DEFAULT_INVENTORY_SETTINGS.allowCloseWithUncounted,
    uncountedMeansZero:
      typeof row.uncountedMeansZero === "boolean"
        ? row.uncountedMeansZero
        : DEFAULT_INVENTORY_SETTINGS.uncountedMeansZero,
    liquidPresets: parseLiquidPresets(row.liquidPresets),
    liquidStep,
    staleOpenDays,
    showMlAlongsideBottles:
      typeof row.showMlAlongsideBottles === "boolean"
        ? row.showMlAlongsideBottles
        : DEFAULT_INVENTORY_SETTINGS.showMlAlongsideBottles,
  };
}

export async function getHotelInventorySettings(
  hotelId: string
): Promise<InventorySettingsJson> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { inventorySettings: true },
  });
  return parseInventorySettings(hotel?.inventorySettings);
}
