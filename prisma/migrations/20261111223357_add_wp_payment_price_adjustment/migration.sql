-- CreateEnum
CREATE TYPE "PriceAdjustmentUnit" AS ENUM ('percent', 'fixed');

-- AlterTable
ALTER TABLE "wp_payment_methods" ADD COLUMN     "price_adjustment_unit" "PriceAdjustmentUnit",
ADD COLUMN     "price_adjustment_value" DECIMAL(12,2);
