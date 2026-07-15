-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "daily_rate" DECIMAL(12,2),
ADD COLUMN     "daily_rate_updated_at" TIMESTAMP(3);
