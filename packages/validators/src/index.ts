import { z } from "zod";
import {
  PAYMENT_METHODS,
  SALE_DISCOUNT_TYPES,
  UNITS,
  VOUCHER_CODES,
} from "@prize/types";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const productCategorySchema = z.object({
  name: z.string().min(1).max(100),
  code: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid code")
    .optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const productBaseSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(64),
  ean: z.string().max(32).optional().nullable(),
  barcode: z.string().max(64).optional().nullable(),
  categoryId: z.string().cuid(),
  subcategory: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  unit: z.enum(UNITS),
  purchasePrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().min(0).max(100),
  supplierId: z.string().cuid().optional().nullable(),
  minStock: z.coerce.number().nonnegative().default(0),
  optimalStock: z.coerce.number().nonnegative().default(0),
  maxStock: z.coerce.number().nonnegative().default(0),
  allergens: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  trackExpiry: z.boolean().default(false),
  trackLiquid: z.boolean().default(false),
  bottleContentMl: z.coerce.number().positive().optional().nullable(),
});

function refineLiquidProduct(
  data: {
    trackLiquid?: boolean;
    bottleContentMl?: number | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.trackLiquid) {
    if (data.bottleContentMl == null || !(data.bottleContentMl > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bottleContentMl required when trackLiquid",
        path: ["bottleContentMl"],
      });
    }
  }
}

export const productSchema = productBaseSchema.superRefine(refineLiquidProduct);

export const productUpdateSchema = productBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.trackLiquid === true) {
      refineLiquidProduct(
        {
          trackLiquid: true,
          bottleContentMl: data.bottleContentMl,
        },
        ctx
      );
    }
  });

export const saleItemInputSchema = z
  .object({
    posArticleId: z.string().cuid().optional(),
    productId: z.string().cuid().optional(),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative().optional(),
    discountPercent: z.coerce.number().min(0).max(100).optional(),
    isComplimentary: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.posArticleId || v.productId), {
    message: "posArticleId or productId required",
  });

export const createSaleSchema = z.object({
  /** Optional; ignored — stock always deducts from the hotel's central Lager. */
  warehouseId: z.string().cuid().optional(),
  cashRegisterId: z.string().cuid().optional(),
  items: z.array(saleItemInputSchema).min(1),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  /** Absolute order discount in currency units (applied after line discounts). */
  discountAmount: z.coerce.number().nonnegative().optional(),
  discountType: z.enum(SALE_DISCOUNT_TYPES).optional(),
  discountReason: z.string().max(200).optional().nullable(),
  voucherCode: z.enum(VOUCHER_CODES).optional().nullable(),
  roomReference: z.string().max(32).optional().nullable(),
  guestName: z.string().max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const paySaleSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.coerce.number().nonnegative().optional(),
  reference: z.string().max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const inventoryCountCreateSchema = z.object({
  name: z.string().min(1).max(200),
  /** @deprecated Ignored — counts always use the central Lager. */
  warehouseId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  productIds: z.array(z.string().cuid()).optional(),
});

export const inventoryCountItemSchema = z.object({
  productId: z.string().cuid(),
  countedQty: z.coerce.number().nonnegative(),
});

export const stockAdjustSchema = z.object({
  productId: z.string().cuid(),
  /** Optional; ignored — adjustments always apply to the central Lager. */
  warehouseId: z.string().cuid().optional(),
  quantity: z.coerce.number(),
  reason: z.string().min(1).max(500),
});

export const cashCloseSchema = z.object({
  countedCash: z.coerce.number().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
});

export const goodsReceiptItemSchema = z.object({
  productId: z.string().cuid(),
  qtyOrdered: z.coerce.number().nonnegative(),
  qtyDelivered: z.coerce.number().nonnegative(),
  qtyDamaged: z.coerce.number().nonnegative().default(0),
  qtyMissing: z.coerce.number().nonnegative().optional(),
  purchasePrice: z.coerce.number().nonnegative(),
  expiryDate: z.string().datetime().optional().nullable(),
  batchNo: z.string().max(64).optional().nullable(),
});

export const createGoodsReceiptSchema = z.object({
  /** Optional; ignored — receipts always stock into the central Lager. */
  warehouseId: z.string().cuid().optional(),
  supplierId: z.string().cuid(),
  purchaseOrderId: z.string().cuid().optional().nullable(),
  deliveryNoteNo: z.string().max(64).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  receivedAt: z.string().datetime().optional(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

export const stockTransferItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
});

/** Transfers are disabled under the single-Lager architecture. */
export const createStockTransferSchema = z.object({
  fromWarehouseId: z.string().cuid(),
  toWarehouseId: z.string().cuid(),
  reason: z.string().max(500).optional().nullable(),
  items: z.array(stockTransferItemSchema).min(1),
});

export const createWasteSchema = z.object({
  productId: z.string().cuid(),
  /** Optional; ignored — waste always reduces central Lager stock. */
  warehouseId: z.string().cuid().optional(),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(1).max(100),
});

export const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(300).optional().nullable(),
  contactName: z.string().max(120).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  leadTimeDays: z.coerce.number().int().nonnegative().default(2),
  minOrderValue: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const deliveryNoteLineUnitSchema = z.enum([
  "PIECE",
  "KG",
  "G",
  "LITER",
  "ML",
  "BOTTLE",
  "CARTON",
  "PACK",
]);

export const deliveryNoteMatchStatusSchema = z.enum([
  "matched",
  "uncertain",
  "unmatched",
  "manual",
  "skipped",
]);

export const deliveryNoteReviewLineSchema = z.object({
  id: z.string().min(1),
  lineIndex: z.number().int().nonnegative(),
  recognizedName: z.string().min(1).max(300),
  recognizedDescription: z.string().max(500).optional().nullable(),
  recognizedSku: z.string().max(64).optional().nullable(),
  recognizedEan: z.string().max(64).optional().nullable(),
  recognizedSupplierSku: z.string().max(64).optional().nullable(),
  quantity: z.coerce.number().nonnegative(),
  unit: deliveryNoteLineUnitSchema.optional().nullable(),
  purchasePrice: z.coerce.number().nonnegative().optional().nullable(),
  batchNo: z.string().max(64).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  matchStatus: deliveryNoteMatchStatusSchema,
  matchMethod: z.string().max(64).optional().nullable(),
  matchConfidence: z.coerce.number().min(0).max(100).optional().nullable(),
  productId: z.string().cuid().optional().nullable(),
  productName: z.string().max(300).optional().nullable(),
  excluded: z.boolean().default(false),
});

export const updateDeliveryNoteScanSchema = z.object({
  supplierId: z.string().cuid().optional().nullable(),
  deliveryNoteNo: z.string().max(64).optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  extractedLines: z.array(deliveryNoteReviewLineSchema).optional(),
});

export const confirmDeliveryNoteScanSchema = z.object({
  /** Required when a possible duplicate exists and the user acknowledges it. */
  acknowledgeDuplicate: z.boolean().optional().default(false),
  supplierId: z.string().cuid().optional(),
  deliveryNoteNo: z.string().max(64).optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  extractedLines: z.array(deliveryNoteReviewLineSchema).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductCategoryInput = z.infer<typeof productCategorySchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type PaySaleInput = z.infer<typeof paySaleSchema>;
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type DeliveryNoteReviewLine = z.infer<typeof deliveryNoteReviewLineSchema>;
export type UpdateDeliveryNoteScanInput = z.infer<typeof updateDeliveryNoteScanSchema>;
export type ConfirmDeliveryNoteScanInput = z.infer<
  typeof confirmDeliveryNoteScanSchema
>;

export const posCategorySchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(32).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const posCategoryReorderSchema = z.object({
  orderedIds: z.array(z.string().cuid()).min(1),
});

export const posArticleCreateFromProductSchema = z.object({
  productId: z.string().cuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  salePrice: z.coerce.number().nonnegative().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  posCategoryId: z.string().cuid().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isFavorite: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const posArticleCreateFromRecipeSchema = z.object({
  recipeId: z.string().cuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  salePrice: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  posCategoryId: z.string().cuid().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isFavorite: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const posArticleUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  salePrice: z.coerce.number().nonnegative().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  posCategoryId: z.string().cuid().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isFavorite: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const posArticleReorderSchema = z.object({
  orderedIds: z.array(z.string().cuid()).min(1),
});

export const posRecipeItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  unit: z.enum(UNITS),
  sortOrder: z.coerce.number().int().optional(),
});

export const posRecipeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  items: z.array(posRecipeItemSchema).min(1),
  instructions: z.string().max(8000).optional().nullable(),
  salePrice: z.coerce.number().nonnegative().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  posCategoryId: z.string().cuid().optional().nullable(),
  createPosArticle: z.boolean().optional(),
});

export const posRecipeUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  items: z.array(posRecipeItemSchema).min(1).optional(),
  isActive: z.boolean().optional(),
  instructions: z.string().max(8000).optional().nullable(),
});

export type PosCategoryInput = z.infer<typeof posCategorySchema>;
export type PosArticleCreateFromProductInput = z.infer<
  typeof posArticleCreateFromProductSchema
>;
export type PosArticleCreateFromRecipeInput = z.infer<
  typeof posArticleCreateFromRecipeSchema
>;
export type PosArticleUpdateInput = z.infer<typeof posArticleUpdateSchema>;
export type PosRecipeCreateInput = z.infer<typeof posRecipeCreateSchema>;
export type PosRecipeUpdateInput = z.infer<typeof posRecipeUpdateSchema>;
