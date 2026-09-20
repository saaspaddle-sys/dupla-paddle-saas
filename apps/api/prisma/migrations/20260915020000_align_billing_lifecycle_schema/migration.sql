-- The first lifecycle migration was already applied in local environments.
-- @updatedAt is maintained by Prisma, not by a database default; dropping the
-- old default makes the live schema match the Prisma model without rewriting
-- migration history.
ALTER TABLE "billing_job_locks"
  ALTER COLUMN "updated_at" DROP DEFAULT;
