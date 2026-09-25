-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "balance_adjustment_ars" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "balance_adjustment_usd" DECIMAL(14,2) NOT NULL DEFAULT 0;
