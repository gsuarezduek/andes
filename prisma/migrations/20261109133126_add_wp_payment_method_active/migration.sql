-- AlterTable
ALTER TABLE "wp_payment_methods" ADD COLUMN     "active" BOOLEAN,
ADD COLUMN     "wp_gateway_id" INTEGER;
