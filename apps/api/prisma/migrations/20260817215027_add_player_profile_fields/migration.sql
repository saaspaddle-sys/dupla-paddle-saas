-- CreateEnum
CREATE TYPE "player_hand" AS ENUM ('right', 'left');

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "country" TEXT,
ADD COLUMN     "dominant_hand" "player_hand",
ADD COLUMN     "emergency_phone" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "province" TEXT;
