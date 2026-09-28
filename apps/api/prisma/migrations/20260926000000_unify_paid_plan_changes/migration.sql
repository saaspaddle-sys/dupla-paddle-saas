ALTER TABLE "subscriptions"
  ADD COLUMN "pending_plan_effective_at" TIMESTAMPTZ(3),
  ADD COLUMN "pending_plan_paid_at" TIMESTAMPTZ(3),
  ADD COLUMN "current_period_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "current_period_amount" DECIMAL(12, 2),
  ADD COLUMN "current_period_currency" VARCHAR(3);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_period_charge_complete" CHECK (
    ("current_period_started_at" IS NULL AND "current_period_amount" IS NULL AND "current_period_currency" IS NULL)
    OR ("current_period_started_at" IS NOT NULL AND "current_period_amount" > 0 AND "current_period_currency" IS NOT NULL)
  );

-- No production data needs grandfathering: the old scheduled upgrade is
-- replaced by a paid immediate operation, while pending-plan tracks downgrades.
UPDATE "subscriptions"
SET "pending_plan" = NULL,
    "pending_plan_amount" = NULL,
    "pending_plan_currency" = NULL,
    "pending_plan_confirmed_at" = NULL,
    "pending_plan_effective_at" = NULL,
    "pending_plan_paid_at" = NULL
WHERE "pending_plan" = 'pro';

ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_pending_plan_quote_complete";
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_pending_plan_quote_complete" CHECK (
    ("pending_plan" IS NULL AND "pending_plan_amount" IS NULL AND "pending_plan_currency" IS NULL AND "pending_plan_confirmed_at" IS NULL AND "pending_plan_effective_at" IS NULL AND "pending_plan_paid_at" IS NULL)
    OR ("pending_plan" = 'basic' AND "pending_plan_amount" > 0 AND "pending_plan_currency" IS NOT NULL AND "pending_plan_effective_at" IS NOT NULL)
  );

CREATE TYPE "upgrade_state" AS ENUM ('creating', 'pending', 'paid', 'applied', 'review_required');

CREATE TABLE "subscription_upgrades" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "preference_id" TEXT,
  "checkout_url" TEXT,
  "payment_id" TEXT,
  "preapproval_id" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "recurring_amount" DECIMAL(12, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "period_started_at" TIMESTAMPTZ(3) NOT NULL,
  "period_ends_at" TIMESTAMPTZ(3) NOT NULL,
  "state" "upgrade_state" NOT NULL DEFAULT 'creating',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "subscription_upgrades_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_upgrades_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subscription_upgrades_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "subscription_upgrades_recurring_amount_positive" CHECK ("recurring_amount" > 0),
  CONSTRAINT "subscription_upgrades_period_valid" CHECK ("period_started_at" < "period_ends_at")
);

CREATE UNIQUE INDEX "subscription_upgrades_reference_key" ON "subscription_upgrades"("reference");
CREATE UNIQUE INDEX "subscription_upgrades_preference_id_key" ON "subscription_upgrades"("preference_id");
CREATE UNIQUE INDEX "subscription_upgrades_payment_id_key" ON "subscription_upgrades"("payment_id");
CREATE INDEX "subscription_upgrades_subscription_id_state_idx" ON "subscription_upgrades"("subscription_id", "state");
CREATE UNIQUE INDEX "subscription_upgrades_one_open_per_subscription" ON "subscription_upgrades"("subscription_id")
  WHERE "state" IN ('creating', 'pending', 'paid', 'review_required');
