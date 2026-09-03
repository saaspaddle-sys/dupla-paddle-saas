-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('mercado_pago');

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL DEFAULT 'mercado_pago',
    "external_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT,
    "resource_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "subscription_id" UUID,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_events_provider_type_resource_id_idx" ON "payment_events"("provider", "type", "resource_id");

-- CreateIndex
CREATE INDEX "payment_events_subscription_id_idx" ON "payment_events"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_external_id_key" ON "payment_events"("provider", "external_id");

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
