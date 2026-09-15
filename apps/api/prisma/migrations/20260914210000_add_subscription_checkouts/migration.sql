CREATE TYPE "checkout_state" AS ENUM ('pending', 'completed', 'expired');
CREATE TABLE "subscription_checkouts" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "provider" "payment_provider" NOT NULL DEFAULT 'mercado_pago',
  "reference" TEXT NOT NULL,
  "target_plan" "subscription_plan" NOT NULL,
  "provider_preapproval_id" TEXT,
  "provider_status" TEXT,
  "state" "checkout_state" NOT NULL DEFAULT 'pending', 
  "init_point" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "subscription_checkouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscription_checkouts_reference_key" ON "subscription_checkouts"("reference");
CREATE UNIQUE INDEX "subscription_checkouts_provider_preapproval_id_key" ON "subscription_checkouts"("provider_preapproval_id");
CREATE INDEX "subscription_checkouts_subscription_id_target_plan_idx" ON "subscription_checkouts"("subscription_id", "target_plan");
CREATE UNIQUE INDEX "subscription_checkouts_one_pending_per_subscription" ON "subscription_checkouts"("subscription_id") WHERE "state" = 'pending';
ALTER TABLE "subscription_checkouts" ADD CONSTRAINT "subscription_checkouts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


