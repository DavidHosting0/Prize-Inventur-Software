export const ACCOUNT_TYPES = ["GROUP", "HOTEL"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.close",
  "stock.view",
  "stock.adjust",
  "pos.sell",
  "pos.refund",
  "pos.cancel",
  "pos.discount",
  "cash.close",
  "pos_config.view",
  "pos_config.create",
  "pos_config.edit",
  "pos_config.delete",
  "pos_config.manage_categories",
  "pos_config.manage_prices",
  "pos_config.manage_recipes",
  "pos_config.manage_layout",
  "orders.view",
  "orders.create",
  "orders.approve",
  "receiving.view",
  "receiving.create",
  "receiving.confirm",
  "suppliers.view",
  "suppliers.manage",
  "waste.view",
  "waste.create",
  "recipes.view",
  "recipes.manage",
  "reports.view",
  "users.manage",
  "users.view",
  "users.create",
  "users.edit",
  "users.disable",
  "settings.manage",
  "audit.view",
  "search.use",
  "hotels.view",
  "hotels.manage",
  "hotels.view_all",
  "analytics.view",
  "analytics.view_all_hotels",
  "analytics.export",
  "permissions.view",
  "permissions.manage",
  "ai_config.view",
  "ai_config.manage",
  "api_config.view",
  "api_config.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_CODES = [
  "GROUP_ADMIN",
  "GROUP_MANAGER",
  "GROUP_ANALYST",
  "GROUP_VIEWER",
  "ADMIN",
  "GENERAL_MANAGER",
  "FB_MANAGER",
  "WAREHOUSE_MANAGER",
  "SUPERVISOR",
  "RECEPTION",
  "BAR",
  "RESTAURANT",
  "KITCHEN",
  "HOUSEKEEPING",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

/** Roles that bypass individual permission checks within their account scope. */
export const ADMIN_ROLE_CODES = ["GROUP_ADMIN", "ADMIN"] as const;

export const SALE_STATUSES = [
  "PENDING",
  "PAID",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

/** TRANSFER retained for historical movements only — new transfers are disabled. */
export const MOVEMENT_TYPES = [
  "SALE",
  "PURCHASE",
  "INVENTORY_ADJUSTMENT",
  "TRANSFER",
  "WASTE",
  "RETURN",
  "MANUAL_ADJUSTMENT",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const UNITS = [
  "PIECE",
  "KG",
  "G",
  "LITER",
  "ML",
  "BOTTLE",
  "CARTON",
  "PACK",
] as const;

export type Unit = (typeof UNITS)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TWINT",
  "OFFLINE",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_DISCOUNT_TYPES = [
  "NONE",
  "MANUAL",
  "VOUCHER_CLUB",
  "VOUCHER_PREMIUM",
  "VOUCHER_VIP",
  "FREE_ITEM",
] as const;
export type SaleDiscountType = (typeof SALE_DISCOUNT_TYPES)[number];

export const VOUCHER_CODES = ["CLUB", "PREMIUM", "VIP"] as const;
export type VoucherCode = (typeof VOUCHER_CODES)[number];

/** Default bar voucher presets (percent off order). */
export const DEFAULT_VOUCHER_PRESETS = [
  { code: "CLUB" as const, name: "Club", discountPercent: 10 },
  { code: "PREMIUM" as const, name: "Premium", discountPercent: 15 },
  { code: "VIP" as const, name: "VIP", discountPercent: 20 },
];

export type VoucherPreset = {
  code: VoucherCode;
  name: string;
  discountPercent: number;
};

/** Default reasons when giving free / complimentary articles. */
export const DEFAULT_COMPLIMENTARY_REASONS = [
  "Mitarbeiter-Konsum",
  "Gäste-Kulanz",
  "Marketing / Probe",
  "Interne Veranstaltung",
  "Beschwerde / Kompensation",
  "Management",
] as const;

export type PosSettingsJson = {
  vouchers?: VoucherPreset[];
  complimentaryReasons?: string[];
};

/** Hotel-level inventory count workflow preferences. */
export type InventorySettingsJson = {
  requireReviewBeforeClose: boolean;
  allowCloseWithUncounted: boolean;
  uncountedMeansZero: boolean;
  liquidPresets: number[];
  liquidStep: number;
  staleOpenDays: number;
  showMlAlongsideBottles: boolean;
};

export const DEFAULT_INVENTORY_SETTINGS: InventorySettingsJson = {
  requireReviewBeforeClose: true,
  allowCloseWithUncounted: false,
  uncountedMeansZero: false,
  liquidPresets: [0, 0.25, 0.5, 0.75, 1],
  liquidStep: 0.05,
  staleOpenDays: 14,
  showMlAlongsideBottles: true,
};

export const POS_ARTICLE_TYPES = ["PRODUCT", "RECIPE"] as const;
export type PosArticleType = (typeof POS_ARTICLE_TYPES)[number];

export type MoneyFormatInput = {
  amount: number | string;
  currency: string;
  locale?: string;
};

export function formatMoney({
  amount,
  currency,
  locale = "de-CH",
}: MoneyFormatInput): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const INTEGRATION_PROVIDERS = [
  "OPENAI",
  "ANTHROPIC",
  "GOOGLE",
  "OTHER",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_PURPOSES = [
  "OCR_DELIVERY_NOTE",
  "GENERAL_AI",
  "EXTERNAL_API",
] as const;
export type IntegrationPurpose = (typeof INTEGRATION_PURPOSES)[number];
