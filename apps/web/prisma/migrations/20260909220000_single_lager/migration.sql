-- Consolidate multi-warehouse inventory into a single central Lager per hotel.
-- Preserves product data, sums stock quantities, keeps historical FKs on inactive warehouses.

-- 1) Ensure every hotel has a LAGER warehouse (promote MAIN when present)
INSERT INTO "Warehouse" ("id", "hotelId", "name", "code", "isActive", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  h."id",
  'Lager',
  'LAGER',
  true,
  NOW(),
  NOW()
FROM "Hotel" h
WHERE NOT EXISTS (
  SELECT 1 FROM "Warehouse" w
  WHERE w."hotelId" = h."id" AND w."code" IN ('LAGER', 'MAIN')
);

-- Rename MAIN to LAGER when LAGER does not yet exist for that hotel
UPDATE "Warehouse" w
SET
  "name" = 'Lager',
  "code" = 'LAGER',
  "isActive" = true,
  "updatedAt" = NOW()
WHERE w."code" = 'MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM "Warehouse" x
    WHERE x."hotelId" = w."hotelId" AND x."code" = 'LAGER'
  );

UPDATE "Warehouse"
SET "name" = 'Lager', "isActive" = true, "updatedAt" = NOW()
WHERE "code" = 'LAGER';

-- 2) Snapshot consolidated quantities BEFORE mutating StockLevel rows
CREATE TEMP TABLE "_stock_consolidate" AS
SELECT
  sl."productId",
  l."id" AS "lagerId",
  SUM(sl."quantity") AS "totalQty",
  SUM(sl."reservedQty") AS "totalReserved",
  MAX(sl."lastMovementAt") AS "lastMovementAt"
FROM "StockLevel" sl
INNER JOIN "Warehouse" w ON w."id" = sl."warehouseId"
INNER JOIN "Warehouse" l ON l."hotelId" = w."hotelId" AND l."code" = 'LAGER'
GROUP BY sl."productId", l."id";

-- Upsert consolidated totals onto LAGER stock rows
INSERT INTO "StockLevel" ("id", "productId", "warehouseId", "quantity", "reservedQty", "lastMovementAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || c."productId"),
  c."productId",
  c."lagerId",
  c."totalQty",
  c."totalReserved",
  c."lastMovementAt",
  NOW()
FROM "_stock_consolidate" c
ON CONFLICT ("productId", "warehouseId") DO UPDATE SET
  "quantity" = EXCLUDED."quantity",
  "reservedQty" = EXCLUDED."reservedQty",
  "lastMovementAt" = EXCLUDED."lastMovementAt",
  "updatedAt" = NOW();

-- Remove stock outside LAGER (quantities already on LAGER)
DELETE FROM "StockLevel" sl
USING "Warehouse" w
WHERE sl."warehouseId" = w."id"
  AND w."code" <> 'LAGER';

DROP TABLE "_stock_consolidate";

-- 3) Point open operational docs at LAGER
UPDATE "InventoryCount" ic
SET "warehouseId" = w."id"
FROM "Warehouse" w
WHERE w."hotelId" = ic."hotelId"
  AND w."code" = 'LAGER'
  AND ic."status" IN ('DRAFT', 'IN_PROGRESS', 'REVIEW');

UPDATE "GoodsReceipt" gr
SET "warehouseId" = w."id"
FROM "Warehouse" w
WHERE w."hotelId" = gr."hotelId"
  AND w."code" = 'LAGER'
  AND gr."status" = 'DRAFT';

UPDATE "Sale" s
SET "warehouseId" = w."id"
FROM "Warehouse" w
WHERE w."hotelId" = s."hotelId"
  AND w."code" = 'LAGER'
  AND s."status" = 'PENDING';

-- 4) Deactivate all non-LAGER warehouses (keep rows for historical FK integrity)
UPDATE "Warehouse"
SET "isActive" = false, "updatedAt" = NOW()
WHERE "code" <> 'LAGER';

UPDATE "Warehouse"
SET "isActive" = true, "name" = 'Lager', "updatedAt" = NOW()
WHERE "code" = 'LAGER';
