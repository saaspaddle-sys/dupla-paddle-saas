ALTER TABLE "subscription_checkouts" ALTER COLUMN "state" SET DEFAULT 'recovery_required';
DROP INDEX "subscription_checkouts_one_pending_per_subscription";
CREATE UNIQUE INDEX "subscription_checkouts_one_active_per_subscription" ON "subscription_checkouts"("subscription_id") WHERE "state" IN ('pending', 'recovery_required');
