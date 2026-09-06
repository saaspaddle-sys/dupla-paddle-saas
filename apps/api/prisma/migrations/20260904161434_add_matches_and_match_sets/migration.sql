-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('pending', 'finished');

-- CreateEnum
CREATE TYPE "match_outcome" AS ENUM ('normal', 'walkover', 'retirement', 'bye');

-- CreateEnum
CREATE TYPE "match_slot" AS ENUM ('a', 'b');

-- CreateEnum
CREATE TYPE "match_set_kind" AS ENUM ('standard', 'super_tiebreak');

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "team_a_id" UUID,
    "team_b_id" UUID,
    "winner_team_id" UUID,
    "status" "match_status" NOT NULL DEFAULT 'pending',
    "outcome" "match_outcome",
    "next_match_id" UUID,
    "next_slot" "match_slot",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_sets" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "kind" "match_set_kind" NOT NULL DEFAULT 'standard',
    "team_a_games" INTEGER,
    "team_b_games" INTEGER,
    "team_a_tiebreak" INTEGER,
    "team_b_tiebreak" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_club_id_idx" ON "matches"("club_id");

-- CreateIndex
CREATE INDEX "matches_tournament_id_status_idx" ON "matches"("tournament_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matches_tournament_id_round_position_key" ON "matches"("tournament_id", "round", "position");

-- CreateIndex
CREATE UNIQUE INDEX "matches_id_club_id_key" ON "matches"("id", "club_id");

-- CreateIndex
CREATE INDEX "match_sets_club_id_idx" ON "match_sets"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_sets_match_id_set_number_key" ON "match_sets"("match_id", "set_number");

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_tournament_id_key" ON "teams"("id", "tournament_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_club_id_fkey" FOREIGN KEY ("tournament_id", "club_id") REFERENCES "tournaments"("id", "club_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_tournament_id_fkey" FOREIGN KEY ("team_a_id", "tournament_id") REFERENCES "teams"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_tournament_id_fkey" FOREIGN KEY ("team_b_id", "tournament_id") REFERENCES "teams"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_next_match_id_fkey" FOREIGN KEY ("next_match_id") REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_match_id_club_id_fkey" FOREIGN KEY ("match_id", "club_id") REFERENCES "matches"("id", "club_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Los CHECK van a mano: Prisma no los modela. El check de drift de CI no los
-- ve (verificado y documentado en la entrada del 2026-09-02), así que no
-- producen diferencia contra `schema.prisma`.

-- Un partido terminado tiene ganador y outcome; uno pendiente no tiene
-- ninguno de los dos. Es el invariante del que dependen el avance del bracket
-- y la corrección de resultados.
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_status_outcome"
  CHECK (
    ("status" = 'pending'  AND "outcome" IS NULL     AND "winner_team_id" IS NULL)
    OR
    ("status" = 'finished' AND "outcome" IS NOT NULL AND "winner_team_id" IS NOT NULL)
  );

-- El ganador tiene que ser uno de los dos lados del partido.
-- `IS NOT DISTINCT FROM` y no `=` a propósito: con `team_b_id` NULL (un bye),
-- `winner_team_id = team_b_id` evalúa a NULL, y un CHECK que da NULL PASA.
-- Con `=` el constraint tendría un agujero justo en los byes.
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_winner_is_a_side"
  CHECK (
    "winner_team_id" IS NULL
    OR "winner_team_id" IS NOT DISTINCT FROM "team_a_id"
    OR "winner_team_id" IS NOT DISTINCT FROM "team_b_id"
  );

-- El puntero de avance es completo o no existe: nunca a medias.
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_next_pointer"
  CHECK (("next_match_id" IS NULL) = ("next_slot" IS NULL));

-- Un bye tiene el lado A ocupado y el B vacío. Fija que el lado que falta es
-- siempre el B, que es lo que produce la secuencia de siembra.
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_bye_shape"
  CHECK (
    "outcome" IS DISTINCT FROM 'bye'
    OR ("team_a_id" IS NOT NULL AND "team_b_id" IS NULL)
  );

-- Coordenadas dentro del cuadro: la ronda arranca en 1, la posición en 0.
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_coordinates"
  CHECK ("round" >= 1 AND "position" >= 0);

-- Un set estándar tiene games de los dos lados y, si hubo tiebreak, los dos
-- marcadores. Un super tiebreak no tiene games y sí tiene los dos marcadores:
-- es una carrera a 10 puntos, no un set.
ALTER TABLE "match_sets"
  ADD CONSTRAINT "match_sets_score_shape"
  CHECK (
    (
      "kind" = 'standard'
      AND "team_a_games" IS NOT NULL AND "team_b_games" IS NOT NULL
      AND (("team_a_tiebreak" IS NULL) = ("team_b_tiebreak" IS NULL))
    )
    OR
    (
      "kind" = 'super_tiebreak'
      AND "team_a_games" IS NULL AND "team_b_games" IS NULL
      AND "team_a_tiebreak" IS NOT NULL AND "team_b_tiebreak" IS NOT NULL
    )
  );

-- Al mejor de 3: no hay cuarto set. Y ningún marcador negativo.
ALTER TABLE "match_sets"
  ADD CONSTRAINT "match_sets_ranges"
  CHECK (
    "set_number" BETWEEN 1 AND 3
    AND COALESCE("team_a_games", 0) >= 0
    AND COALESCE("team_b_games", 0) >= 0
    AND COALESCE("team_a_tiebreak", 0) >= 0
    AND COALESCE("team_b_tiebreak", 0) >= 0
  );
