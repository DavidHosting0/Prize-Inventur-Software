-- Performance indexes for multi-hotel scale (hotel-scoped list/search queries)
CREATE INDEX IF NOT EXISTS "Product_hotelId_name_idx" ON "Product"("hotelId", "name");
CREATE INDEX IF NOT EXISTS "Product_hotelId_barcode_idx" ON "Product"("hotelId", "barcode");
CREATE INDEX IF NOT EXISTS "Product_hotelId_ean_idx" ON "Product"("hotelId", "ean");
CREATE INDEX IF NOT EXISTS "Recipe_hotelId_idx" ON "Recipe"("hotelId");
CREATE INDEX IF NOT EXISTS "Recipe_hotelId_name_idx" ON "Recipe"("hotelId", "name");
CREATE INDEX IF NOT EXISTS "RecipeItem_recipeId_idx" ON "RecipeItem"("recipeId");
CREATE INDEX IF NOT EXISTS "RecipeItem_productId_idx" ON "RecipeItem"("productId");
