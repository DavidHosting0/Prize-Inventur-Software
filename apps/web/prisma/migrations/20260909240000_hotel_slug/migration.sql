-- Add unique hotel slug for URLs like /bern/de/dashboard

ALTER TABLE "Hotel" ADD COLUMN "slug" TEXT;

-- Backfill from city or sanitized name
UPDATE "Hotel"
SET "slug" = lower(regexp_replace(coalesce(nullif(trim("city"), ''), "name"), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Ensure uniqueness by appending short id when collisions remain
UPDATE "Hotel" h
SET "slug" = h."slug" || '-' || substr(h."id", 1, 6)
WHERE h."id" IN (
  SELECT id FROM (
    SELECT id, "slug", ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt") AS rn
    FROM "Hotel"
  ) d
  WHERE rn > 1
);

-- Fallback if still empty
UPDATE "Hotel"
SET "slug" = 'hotel-' || substr("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Hotel" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Hotel_slug_key" ON "Hotel"("slug");
