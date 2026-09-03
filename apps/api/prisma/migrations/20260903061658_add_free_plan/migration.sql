-- AlterEnum
ALTER TYPE "subscription_plan" ADD VALUE 'free';

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "plan" SET DEFAULT 'free';
