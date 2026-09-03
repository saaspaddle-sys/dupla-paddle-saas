-- CreateEnum
CREATE TYPE "tournament_status" AS ENUM ('open', 'in_progress', 'finished', 'canceled');

-- CreateEnum
CREATE TYPE "tournament_format" AS ENUM ('single_elimination');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "format" "tournament_format" NOT NULL DEFAULT 'single_elimination',
    "status" "tournament_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "player1_id" UUID NOT NULL,
    "player2_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournaments_club_id_status_idx" ON "tournaments"("club_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_id_club_id_key" ON "tournaments"("id", "club_id");

-- CreateIndex
CREATE INDEX "teams_club_id_idx" ON "teams"("club_id");

-- CreateIndex
CREATE INDEX "teams_player1_id_idx" ON "teams"("player1_id");

-- CreateIndex
CREATE INDEX "teams_player2_id_idx" ON "teams"("player2_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tournament_id_player1_id_player2_id_key" ON "teams"("tournament_id", "player1_id", "player2_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_club_id_fkey" FOREIGN KEY ("tournament_id", "club_id") REFERENCES "tournaments"("id", "club_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orden canónico de la dupla, agregado a mano: Prisma no modela CHECK.
-- Subsume la regla `player1_id != player2_id` (si son iguales, `<` es falso)
-- y es lo que hace que el unique de (tournament_id, player1_id, player2_id)
-- realmente impida que (A,B) y (B,A) entren como dos duplas distintas.
ALTER TABLE "teams"
  ADD CONSTRAINT "teams_canonical_order"
  CHECK ("player1_id" < "player2_id");
