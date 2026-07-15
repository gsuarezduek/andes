-- AlterTable
ALTER TABLE "condition_settings" ADD COLUMN     "deductible" DECIMAL(12,2),
ADD COLUMN     "deductible_reduced" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "booking_accessories" TEXT,
ADD COLUMN     "booking_accessories_amount" DECIMAL(12,2),
ADD COLUMN     "booking_insurance_upgrade" BOOLEAN NOT NULL DEFAULT false;
