-- Multi-tenant: AccountType, User.organizationId/accountType, Role.scope, AuditLog org fields, SystemIntegration

CREATE TYPE "AccountType" AS ENUM ('GROUP', 'HOTEL');

ALTER TABLE "Role" ADD COLUMN "scope" "AccountType" NOT NULL DEFAULT 'HOTEL';

ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "User" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'HOTEL';

-- Backfill organizationId from first linked hotel (fallback: sole/first org)
UPDATE "User" u
SET "organizationId" = sub."organizationId"
FROM (
  SELECT uh."userId", h."organizationId"
  FROM "UserHotel" uh
  JOIN "Hotel" h ON h.id = uh."hotelId"
  WHERE uh."isDefault" = true
) sub
WHERE u.id = sub."userId" AND u."organizationId" IS NULL;

UPDATE "User" u
SET "organizationId" = sub."organizationId"
FROM (
  SELECT DISTINCT ON (uh."userId") uh."userId", h."organizationId"
  FROM "UserHotel" uh
  JOIN "Hotel" h ON h.id = uh."hotelId"
  ORDER BY uh."userId", uh."isDefault" DESC
) sub
WHERE u.id = sub."userId" AND u."organizationId" IS NULL;

UPDATE "User" u
SET "organizationId" = (SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE u."organizationId" IS NULL
  AND EXISTS (SELECT 1 FROM "Organization");

-- Users with more than one hotel -> GROUP; single hotel -> HOTEL
UPDATE "User" u
SET "accountType" = 'GROUP'
WHERE (
  SELECT COUNT(*) FROM "UserHotel" uh WHERE uh."userId" = u.id
) > 1;

UPDATE "User" u
SET "accountType" = 'HOTEL'
WHERE (
  SELECT COUNT(*) FROM "UserHotel" uh WHERE uh."userId" = u.id
) <= 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate: User rows without organizationId remain';
  END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "User_accountType_idx" ON "User"("accountType");

UPDATE "Organization" SET name = 'Prize by Radisson'
WHERE name IN ('Prize Demo', 'Prize Hotel', 'Demo Organization');

ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "accountType" "AccountType";

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

UPDATE "AuditLog" a
SET "organizationId" = h."organizationId"
FROM "Hotel" h
WHERE a."hotelId" = h.id AND a."organizationId" IS NULL;

CREATE TABLE "SystemIntegration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "model" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "secretCiphertext" TEXT,
  "secretIv" TEXT,
  "secretAuthTag" TEXT,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemIntegration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SystemIntegration" ADD CONSTRAINT "SystemIntegration_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SystemIntegration_organizationId_purpose_provider_key"
  ON "SystemIntegration"("organizationId", "purpose", "provider");

CREATE INDEX "SystemIntegration_organizationId_idx" ON "SystemIntegration"("organizationId");

UPDATE "Role" SET "scope" = 'GROUP'
WHERE "code" IN ('GROUP_ADMIN', 'GROUP_MANAGER', 'GROUP_ANALYST', 'GROUP_VIEWER');
