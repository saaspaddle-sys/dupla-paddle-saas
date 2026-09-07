-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "seed" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "teams_tournament_id_seed_key" ON "teams"("tournament_id", "seed");


-- La cabeza de serie arranca en 1: un seed 0 o negativo no significa nada y
-- rompería el mapeo contra las posiciones protegidas del cuadro.
ALTER TABLE "teams"
  ADD CONSTRAINT "teams_seed_positive"
  CHECK ("seed" IS NULL OR "seed" >= 1);
