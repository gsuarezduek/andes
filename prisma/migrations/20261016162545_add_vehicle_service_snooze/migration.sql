-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "service_snoozed_by_name" TEXT,
ADD COLUMN     "service_snoozed_until" TIMESTAMP(3),
ADD COLUMN     "service_snoozed_until_km" INTEGER;
