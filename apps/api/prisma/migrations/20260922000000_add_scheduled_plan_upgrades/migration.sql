ALTER TABLE "subscriptions"
  ADD COLUMN "pending_plan" "subscription_plan",
  ADD COLUMN "pending_plan_amount" DECIMAL(12, 2),
  ADD COLUMN "pending_plan_currency" VARCHAR(3),
  ADD COLUMN "pending_plan_confirmed_at" TIMESTAMPTZ(3);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_pending_plan_quote_complete"
  CHECK (
    ("pending_plan" IS NULL AND "pending_plan_amount" IS NULL AND "pending_plan_currency" IS NULL AND "pending_plan_confirmed_at" IS NULL)
    OR
    ("pending_plan" = 'pro' AND "pending_plan_amount" IS NOT NULL AND "pending_plan_amount" > 0 AND "pending_plan_currency" IS NOT NULL)
  );
