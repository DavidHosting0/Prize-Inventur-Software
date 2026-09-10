-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OFFLINE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaleDiscountType" AS ENUM ('NONE', 'MANUAL', 'VOUCHER_CLUB', 'VOUCHER_PREMIUM', 'VOUCHER_VIP', 'FREE_ITEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Hotel
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "posSettings" JSONB;

-- AlterTable Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "discountType" "SaleDiscountType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "discountReason" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "voucherCode" TEXT;

-- AlterTable SaleItem
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "isComplimentary" BOOLEAN NOT NULL DEFAULT false;
