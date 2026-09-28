ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'past_due';

ALTER TABLE "subscriptions"
  ADD COLUMN "provider_preapproval_id" TEXT,
  ADD COLUMN "provider_status" TEXT,
  ADD COLUMN "current_period_ends_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "subscriptions_provider_preapproval_id_key"
  ON "subscriptions"("provider_preapproval_id")
  WHERE "provider_preapproval_id" IS NOT NULL;

ALTER TABLE "payment_events"
  ADD COLUMN "last_error_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "payment_events_provider_type_resource_id_key"
  ON "payment_events"("provider", "type", "resource_id");

CREATE TABLE "billing_job_locks" (
  "name" TEXT NOT NULL,
  "owner_token" TEXT NOT NULL,
  "locked_until" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_job_locks_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "subscription_preapproval_tombstones" (
  "id" UUID NOT NULL,
  "provider" "payment_provider" NOT NULL,
  "provider_preapproval_id" TEXT NOT NULL,
  "subscription_id" UUID NOT NULL,
  "canceled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_preapproval_tombstones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_preapproval_tombstones_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subscription_preapproval_tombstones_provider_provider_preapproval_id_key"
  ON "subscription_preapproval_tombstones"("provider", "provider_preapproval_id");
