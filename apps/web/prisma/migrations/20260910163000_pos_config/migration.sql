-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PosArticleType" AS ENUM ('PRODUCT', 'RECIPE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable SaleItem
ALTER TABLE "SaleItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "posArticleId" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "recipeId" TEXT;

-- AlterTable RecipeItem
ALTER TABLE "RecipeItem" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable PosCategory
CREATE TABLE IF NOT EXISTS "PosCategory" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PosCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable PosArticle
CREATE TABLE IF NOT EXISTS "PosArticle" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "type" "PosArticleType" NOT NULL,
    "productId" TEXT,
    "recipeId" TEXT,
    "posCategoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "salePrice" DECIMAL(12,4) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 8.1,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PosArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable PosPriceHistory
CREATE TABLE IF NOT EXISTS "PosPriceHistory" (
    "id" TEXT NOT NULL,
    "posArticleId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "userId" TEXT,
    "oldPrice" DECIMAL(12,4) NOT NULL,
    "newPrice" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PosCategory_hotelId_name_key" ON "PosCategory"("hotelId", "name");
CREATE INDEX IF NOT EXISTS "PosCategory_hotelId_sortOrder_idx" ON "PosCategory"("hotelId", "sortOrder");
CREATE INDEX IF NOT EXISTS "PosCategory_hotelId_isActive_idx" ON "PosCategory"("hotelId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "PosArticle_hotelId_productId_key" ON "PosArticle"("hotelId", "productId");
CREATE UNIQUE INDEX IF NOT EXISTS "PosArticle_hotelId_recipeId_key" ON "PosArticle"("hotelId", "recipeId");
CREATE INDEX IF NOT EXISTS "PosArticle_hotelId_isActive_sortOrder_idx" ON "PosArticle"("hotelId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "PosArticle_hotelId_type_idx" ON "PosArticle"("hotelId", "type");
CREATE INDEX IF NOT EXISTS "PosArticle_hotelId_posCategoryId_idx" ON "PosArticle"("hotelId", "posCategoryId");
CREATE INDEX IF NOT EXISTS "PosArticle_productId_idx" ON "PosArticle"("productId");
CREATE INDEX IF NOT EXISTS "PosArticle_recipeId_idx" ON "PosArticle"("recipeId");

CREATE INDEX IF NOT EXISTS "PosPriceHistory_posArticleId_createdAt_idx" ON "PosPriceHistory"("posArticleId", "createdAt");
CREATE INDEX IF NOT EXISTS "PosPriceHistory_hotelId_createdAt_idx" ON "PosPriceHistory"("hotelId", "createdAt");

CREATE INDEX IF NOT EXISTS "SaleItem_posArticleId_idx" ON "SaleItem"("posArticleId");
CREATE INDEX IF NOT EXISTS "SaleItem_recipeId_idx" ON "SaleItem"("recipeId");

ALTER TABLE "PosCategory" ADD CONSTRAINT "PosCategory_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosArticle" ADD CONSTRAINT "PosArticle_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosArticle" ADD CONSTRAINT "PosArticle_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosArticle" ADD CONSTRAINT "PosArticle_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosArticle" ADD CONSTRAINT "PosArticle_posCategoryId_fkey" FOREIGN KEY ("posCategoryId") REFERENCES "PosCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosPriceHistory" ADD CONSTRAINT "PosPriceHistory_posArticleId_fkey" FOREIGN KEY ("posArticleId") REFERENCES "PosArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_posArticleId_fkey" FOREIGN KEY ("posArticleId") REFERENCES "PosArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
