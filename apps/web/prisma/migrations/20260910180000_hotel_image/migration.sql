-- Hotel cover image for group dashboard / hotel cards
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
