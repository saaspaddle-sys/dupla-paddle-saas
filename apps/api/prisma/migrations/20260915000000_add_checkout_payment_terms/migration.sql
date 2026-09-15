ALTER TABLE "subscription_checkouts"
  ADD COLUMN "amount" DECIMAL(12,2),
  ADD COLUMN "currency" TEXT;

-- Las reservas anteriores no llevan terminos verificables. Expirarlas en la
-- misma transaccion evita que un deploy deje una reserva pending que nunca
-- pueda correlacionarse y bloquee un checkout nuevo.
UPDATE "subscription_checkouts"
SET "amount" = 0,
    "currency" = '',
    "state" = 'expired'
WHERE "amount" IS NULL OR "currency" IS NULL;

ALTER TABLE "subscription_checkouts"
  ALTER COLUMN "amount" SET NOT NULL,
  ALTER COLUMN "currency" SET NOT NULL;
